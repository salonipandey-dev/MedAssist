"""Sign-in, sign-out and server-side sessions for fictional patient accounts.

A session is a database row. The browser holds a random token in an HttpOnly,
SameSite=Strict cookie; the database keeps only the token's SHA-256 digest.
A session ends after a period without requests, at a fixed maximum age, or
when the patient signs out, and an ended session can never be used again.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import delete, func, insert, or_, select, update
from sqlalchemy.orm import Session

from app.models import Account, AuthSession
from app.schemas import AccountSummary, ApiErrorResponse, SessionResponse, SignInRequest
from app.security import (
    SESSION_COOKIE,
    ApiError,
    check_request_origin,
    clear_session_cookie,
    hash_password,
    new_token,
    password_hasher,
    reject_query_parameters,
    require_csrf,
    require_json,
    set_session_cookie,
    token_digest,
    transaction,
    verify_password,
)

logger = logging.getLogger("medassist.auth")

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Sign-in"],
    dependencies=[Depends(check_request_origin), Depends(reject_query_parameters)],
)

_SIGNED_OUT = {"model": ApiErrorResponse, "description": "No valid session."}
_UNAVAILABLE = {"description": "The account database is unavailable."}
# Tokens from new_token() are 43 characters; anything far longer is not ours.
_MAX_COOKIE_LENGTH = 128


@dataclass(frozen=True)
class CurrentSession:
    """The signed-in account, as established from the session cookie alone."""

    account_id: int
    display_name: str
    email: str
    role: str
    csrf_token: str
    expires_at: datetime
    idle_expires_at: datetime

    def to_response(self) -> SessionResponse:
        return SessionResponse(
            account=AccountSummary(
                display_name=self.display_name, email=self.email, role=self.role
            ),
            csrf_token=self.csrf_token,
            expires_at=self.expires_at,
            idle_expires_at=self.idle_expires_at,
        )


def _idle(request: Request) -> timedelta:
    return timedelta(minutes=request.app.state.session_settings.idle_minutes)


def _max_age(request: Request) -> timedelta:
    return timedelta(hours=request.app.state.session_settings.max_hours)


def find_session(request: Request, db: Session) -> Optional[CurrentSession]:
    """Return the live session named by the cookie and extend its idle timer,
    or None when there is no cookie or the session has ended."""
    token = request.cookies.get(SESSION_COOKIE)
    if not token or len(token) > _MAX_COOKIE_LENGTH:
        return None
    now = func.now()
    row = db.execute(
        update(AuthSession)
        .where(
            AuthSession.token_hash == token_digest(token),
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
            AuthSession.idle_expires_at > now,
        )
        .values(
            last_seen_at=now,
            idle_expires_at=func.least(now + _idle(request), AuthSession.expires_at),
        )
        .returning(
            AuthSession.account_id,
            AuthSession.csrf_token,
            AuthSession.expires_at,
            AuthSession.idle_expires_at,
        )
    ).one_or_none()
    if row is None:
        return None
    account = db.execute(
        select(Account.display_name, Account.email, Account.role).where(
            Account.id == row.account_id
        )
    ).one()
    return CurrentSession(
        account_id=row.account_id,
        display_name=account.display_name,
        email=account.email,
        role=account.role,
        csrf_token=row.csrf_token,
        expires_at=row.expires_at,
        idle_expires_at=row.idle_expires_at,
    )


def authenticate(request: Request, db: Session) -> CurrentSession:
    """Like find_session, but refuse the request when nobody is signed in."""
    current = find_session(request, db)
    if current is not None:
        return current
    if SESSION_COOKIE in request.cookies:
        raise ApiError(
            401,
            "session_expired",
            "Your session has ended. Sign in again to continue.",
            clear_session=True,
        )
    raise ApiError(401, "not_signed_in", "Sign in to continue.")


@router.post(
    "/sign-in",
    summary="Sign in with an email and password",
    dependencies=[Depends(require_json)],
    responses={
        401: {"model": ApiErrorResponse, "description": "Email or password is incorrect."},
        503: _UNAVAILABLE,
    },
)
def sign_in(body: SignInRequest, request: Request, response: Response) -> SessionResponse:
    """Start a new session. The token is set only as an HttpOnly cookie. Any
    session this browser already had is ended, so a planted cookie cannot be
    carried into the new sign-in."""
    email = body.email.strip().lower()
    with transaction(request) as db:
        account = db.scalar(select(Account).where(Account.email == email))
        if not verify_password(account.password_hash if account else None, body.password):
            logger.info("sign-in refused request_id=%s", request.state.request_id)
            raise ApiError(
                401, "invalid_credentials", "The email or password is incorrect."
            )
        if password_hasher.check_needs_rehash(account.password_hash):
            account.password_hash = hash_password(body.password)

        previous = request.cookies.get(SESSION_COOKIE)
        if previous and len(previous) <= _MAX_COOKIE_LENGTH:
            db.execute(
                update(AuthSession)
                .where(
                    AuthSession.token_hash == token_digest(previous),
                    AuthSession.revoked_at.is_(None),
                )
                .values(revoked_at=func.now())
            )
        # Ended sessions for this account are no longer useful to anyone.
        db.execute(
            delete(AuthSession).where(
                AuthSession.account_id == account.id,
                or_(
                    AuthSession.revoked_at.is_not(None),
                    AuthSession.expires_at <= func.now(),
                    AuthSession.idle_expires_at <= func.now(),
                ),
            )
        )
        token, csrf_token = new_token(), new_token()
        now = func.now()
        created = db.execute(
            insert(AuthSession)
            .values(
                account_id=account.id,
                token_hash=token_digest(token),
                csrf_token=csrf_token,
                expires_at=now + _max_age(request),
                idle_expires_at=func.least(now + _idle(request), now + _max_age(request)),
            )
            .returning(AuthSession.expires_at, AuthSession.idle_expires_at)
        ).one()
        current = CurrentSession(
            account_id=account.id,
            display_name=account.display_name,
            email=account.email,
            role=account.role,
            csrf_token=csrf_token,
            expires_at=created.expires_at,
            idle_expires_at=created.idle_expires_at,
        )
    set_session_cookie(request, response, token)
    return current.to_response()


@router.get(
    "/session",
    summary="Read the signed-in account",
    responses={401: _SIGNED_OUT, 503: _UNAVAILABLE},
)
def read_session(request: Request) -> SessionResponse:
    """Return the account for the session cookie and its CSRF token. A page
    calls this after a reload to find out whether it is still signed in."""
    with transaction(request) as db:
        return authenticate(request, db).to_response()


@router.post(
    "/sign-out",
    summary="End the current session",
    status_code=204,
    responses={403: {"model": ApiErrorResponse}, 503: _UNAVAILABLE},
)
def sign_out(request: Request) -> Response:
    """End the session so its cookie can never be used again, and clear the
    cookie. Signing out without a live session simply clears the cookie."""
    response = Response(status_code=204)
    if SESSION_COOKIE in request.cookies:
        with transaction(request) as db:
            current = find_session(request, db)
            if current is not None:
                require_csrf(request, current.csrf_token)
                db.execute(
                    update(AuthSession)
                    .where(
                        AuthSession.token_hash
                        == token_digest(request.cookies[SESSION_COOKIE]),
                        AuthSession.account_id == current.account_id,
                    )
                    .values(revoked_at=func.now())
                )
    clear_session_cookie(request, response)
    return response
