"""Shared protections for the private endpoints (sign-in and health profiles).

Nothing in this module logs or returns request bodies, passwords, session
tokens or profile contents. Logs carry the request ID and the kind of failure.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from contextlib import contextmanager
from functools import lru_cache
from typing import Any, Iterator, Optional

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger("medassist.security")

# Paths that carry account or health data. Every response under them is sent
# with Cache-Control: no-store (see middleware.PrivateNoStoreMiddleware).
PRIVATE_PATH_PREFIXES = ("/api/v1/auth", "/api/v1/me")

SESSION_COOKIE = "medassist_session"
SESSION_COOKIE_PATH = "/api/v1"
CSRF_HEADER = "X-CSRF-Token"
UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
# Fields that would name an owner or a profile. The profile owner always comes
# from the session, so supplying any of these is refused with a clear message.
OWNER_FIELDS = frozenset(
    {"account_id", "owner_id", "profile_id", "patient_id", "user_id", "email", "owner"}
)
UNAVAILABLE_MESSAGE = "Your account service is temporarily unavailable. Please try again later."

# argon2-cffi's default PasswordHasher uses Argon2id with the RFC 9106
# low-memory parameters (t=3, m=64 MiB, p=4).
password_hasher = PasswordHasher()


# --- Passwords and tokens ------------------------------------------------------


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


@lru_cache(maxsize=1)
def _dummy_hash() -> str:
    return password_hasher.hash(secrets.token_urlsafe(24))


def verify_password(stored_hash: Optional[str], password: str) -> bool:
    """Check a password. An unknown account is checked against a throwaway hash
    so both cases take about the same time."""
    try:
        return password_hasher.verify(stored_hash or _dummy_hash(), password) and bool(
            stored_hash
        )
    except (VerificationError, InvalidHashError):
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def tokens_match(supplied: str, expected: str) -> bool:
    return hmac.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8"))


# --- Cookies -------------------------------------------------------------------


def _secure(request: Request) -> bool:
    return request.app.state.session_settings.always_secure or request.url.scheme == "https"


def set_session_cookie(request: Request, response: Response, token: str) -> None:
    settings = request.app.state.session_settings
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.max_hours * 3600,
        path=SESSION_COOKIE_PATH,
        secure=_secure(request),
        httponly=True,
        samesite="strict",
    )


def clear_session_cookie(request: Request, response: Response) -> None:
    response.delete_cookie(
        SESSION_COOKIE,
        path=SESSION_COOKIE_PATH,
        secure=_secure(request),
        httponly=True,
        samesite="strict",
    )


# --- Errors --------------------------------------------------------------------


class ApiError(Exception):
    """An expected refusal with a stable `code` and a message safe to display."""

    def __init__(
        self,
        status_code: int,
        code: str,
        detail: str,
        *,
        clear_session: bool = False,
        extra: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(code)
        self.status_code = status_code
        self.code = code
        self.detail = detail
        self.clear_session = clear_session
        self.extra = extra or {}


def api_error_response(request: Request, error: ApiError) -> JSONResponse:
    response = JSONResponse(
        status_code=error.status_code,
        content={"detail": error.detail, "code": error.code, **error.extra},
    )
    if error.clear_session:
        clear_session_cookie(request, response)
    return response


class AccountServiceUnavailableError(Exception):
    """The database behind sign-in or profiles cannot be used; cause is logged only."""


def account_service_unavailable_response(request: Request, _: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "detail": UNAVAILABLE_MESSAGE,
            "code": "service_unavailable",
            "request_id": request.state.request_id,
        },
    )


def _validation_message(error: dict) -> str:
    location = error.get("loc", ())
    if error.get("type") == "extra_forbidden" and location and location[-1] in OWNER_FIELDS:
        return "The profile owner comes from your sign-in and cannot be supplied."
    message = str(error.get("msg", "Invalid value."))
    return message.removeprefix("Value error, ")


async def validation_error_response(request: Request, error: RequestValidationError):
    """On private paths, report where and why input was refused without echoing
    the submitted values back (FastAPI's default includes them)."""
    if not request.url.path.startswith(PRIVATE_PATH_PREFIXES):
        return await request_validation_exception_handler(request, error)
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {
                    "loc": list(item.get("loc", ())),
                    "msg": _validation_message(item),
                    "type": item.get("type", "value_error"),
                }
                for item in error.errors()
            ],
            "code": "invalid_input",
        },
    )


# --- Request checks ------------------------------------------------------------


def check_request_origin(request: Request) -> None:
    """Refuse state-changing browser requests from pages that are not allowed.

    Browsers send Origin on every cross-origin request and on same-origin
    POST/PUT. A request without Origin comes from a non-browser client, which
    cannot ride on someone else's cookie. Together with SameSite=Strict, the
    JSON-only bodies and the per-session CSRF token, this blocks cross-site
    request forgery.
    """
    if request.method not in UNSAFE_METHODS:
        return
    origin = request.headers.get("origin")
    if origin is None:
        return
    own = f"{request.url.scheme}://{request.url.netloc}"
    if origin != own and origin not in request.app.cors_origins:
        raise ApiError(
            403,
            "origin_not_allowed",
            "This page is not allowed to change MedAssist account data.",
        )


def require_json(request: Request) -> None:
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type != "application/json":
        raise ApiError(415, "unsupported_media_type", "Send this request as application/json.")


def reject_query_parameters(request: Request) -> None:
    if request.query_params:
        raise ApiError(
            400,
            "unexpected_parameter",
            "This endpoint takes no query parameters. Your profile is chosen by your sign-in.",
        )


def require_csrf(request: Request, expected: str) -> None:
    supplied = request.headers.get(CSRF_HEADER, "")
    if not supplied or not tokens_match(supplied, expected):
        raise ApiError(
            403,
            "csrf_failed",
            "This request could not be verified. Reload the page and try again.",
        )


# --- Database ------------------------------------------------------------------


@contextmanager
def transaction(request: Request) -> Iterator[Session]:
    """One database transaction for one request. Any exception rolls it back."""
    engine = request.app.state.database_engine
    try:
        if engine is None:
            raise AccountServiceUnavailableError("MEDASSIST_DATABASE_URL is not set")
        with Session(engine) as session, session.begin():
            yield session
    except (SQLAlchemyError, AccountServiceUnavailableError) as error:
        logger.error(
            "account service unavailable request_id=%s cause=%s",
            request.state.request_id,
            type(error).__name__,
        )
        raise AccountServiceUnavailableError from error
