"""The signed-in patient's own health profile: medicines, allergies, conditions.

There is no profile ID in any URL or body. The owner is always the account of
the session cookie, and every query below is filtered by that account ID.
A save replaces the whole profile inside one transaction and only succeeds when
it started from the version currently stored, so a stale tab cannot overwrite
newer changes.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.auth import authenticate
from app.models import PROFILE_SECTIONS, HealthProfile, HealthProfileEntry
from app.schemas import (
    ApiErrorResponse,
    HealthProfileResponse,
    HealthProfileUpdate,
    ProfileEntry,
    ProfileSection,
    SectionState,
    VersionConflictResponse,
)
from app.security import (
    ApiError,
    check_request_origin,
    reject_query_parameters,
    require_csrf,
    require_json,
    transaction,
)

router = APIRouter(
    prefix="/api/v1/me",
    tags=["Health profile"],
    dependencies=[Depends(check_request_origin), Depends(reject_query_parameters)],
)

_COMMON = {
    401: {"model": ApiErrorResponse, "description": "Not signed in, or the session ended."},
    503: {"description": "The account database is unavailable."},
}


def _empty_section() -> ProfileSection:
    return ProfileSection(state=SectionState.not_recorded, entries=[])


def load_profile(db: Session, account_id: int) -> HealthProfileResponse:
    profile = db.get(HealthProfile, account_id)
    if profile is None:
        return HealthProfileResponse(
            version=0,
            updated_at=None,
            medicines=_empty_section(),
            allergies=_empty_section(),
            conditions=_empty_section(),
        )
    rows = db.scalars(
        select(HealthProfileEntry)
        .where(HealthProfileEntry.account_id == account_id)
        .order_by(HealthProfileEntry.section, HealthProfileEntry.position)
    ).all()
    entries = {section: [] for section in PROFILE_SECTIONS}
    for row in rows:
        entries[row.section].append(ProfileEntry(name=row.name, note=row.note))
    return HealthProfileResponse(
        version=profile.version,
        updated_at=profile.updated_at,
        **{
            section: ProfileSection(
                state=getattr(profile, f"{section}_state"), entries=entries[section]
            )
            for section in PROFILE_SECTIONS
        },
    )


def save_profile(db: Session, account_id: int, body: HealthProfileUpdate) -> bool:
    """Write the profile if `body.version` is current. Returns False on a stale
    version, leaving the caller to roll back."""
    states = {
        f"{section}_state": getattr(body, section).state.value for section in PROFILE_SECTIONS
    }
    if body.version == 0:
        saved = db.execute(
            pg_insert(HealthProfile)
            .values(account_id=account_id, version=1, **states)
            .on_conflict_do_nothing(index_elements=["account_id"])
            .returning(HealthProfile.version)
        ).scalar_one_or_none()
    else:
        # The row lock taken here makes a concurrent save of the same version
        # wait, then find the version already moved on.
        saved = db.execute(
            update(HealthProfile)
            .where(
                HealthProfile.account_id == account_id,
                HealthProfile.version == body.version,
            )
            .values(version=HealthProfile.version + 1, updated_at=func.now(), **states)
            .returning(HealthProfile.version)
        ).scalar_one_or_none()
    if saved is None:
        return False

    db.execute(delete(HealthProfileEntry).where(HealthProfileEntry.account_id == account_id))
    rows = [
        {
            "account_id": account_id,
            "section": section,
            "position": position,
            "name": entry.name,
            "note": entry.note,
        }
        for section in PROFILE_SECTIONS
        for position, entry in enumerate(getattr(body, section).entries)
    ]
    if rows:
        db.execute(insert(HealthProfileEntry), rows)
    return True


@router.get(
    "/health-profile",
    summary="Read your own health profile",
    responses=_COMMON,
)
def read_health_profile(request: Request) -> HealthProfileResponse:
    """Return the signed-in patient's profile. A profile never saved comes back
    as version 0 with every section `not_recorded`."""
    with transaction(request) as db:
        current = authenticate(request, db)
        return load_profile(db, current.account_id)


@router.put(
    "/health-profile",
    summary="Replace your own health profile",
    dependencies=[Depends(require_json)],
    responses={
        **_COMMON,
        403: {"model": ApiErrorResponse, "description": "Missing or wrong CSRF token."},
        409: {
            "model": VersionConflictResponse,
            "description": "The profile changed after this edit started.",
        },
        422: {"description": "Invalid entries, or an owner or profile ID was supplied."},
    },
)
def replace_health_profile(
    body: HealthProfileUpdate, request: Request
) -> HealthProfileResponse:
    """Save all three sections at once. Send the `version` you loaded and the
    session's CSRF token in X-CSRF-Token. Nothing is saved on any error."""
    with transaction(request) as db:
        current = authenticate(request, db)
        require_csrf(request, current.csrf_token)
        if not save_profile(db, current.account_id, body):
            stored = db.scalar(
                select(HealthProfile.version).where(
                    HealthProfile.account_id == current.account_id
                )
            )
            raise ApiError(
                409,
                "version_conflict",
                "This profile was changed somewhere else after you started editing. "
                "Reload it to see the latest version before saving again.",
                extra={"current_version": stored or 0},
            )
        return load_profile(db, current.account_id)
