"""Read-only consultation directory backed by PostgreSQL."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import models
from app.schemas import (
    ConsultationFee,
    ConsultationListing,
    ConsultationMode,
    ConsultationPage,
    ConsultationSourceInfo,
    FeeState,
    ServiceErrorResponse,
)

logger = logging.getLogger("medassist.consultations")

SEARCH_MAX_LENGTH = 60  # same limit as the search box in the frontend
DEFAULT_LIMIT = 20
MAX_LIMIT = 50
MAX_OFFSET = 10_000
MAX_FEE_MINOR = 100_000_000  # ₹10 lakh; far above any consultation fee
UNAVAILABLE_MESSAGE = (
    "The consultation directory is temporarily unavailable. Please try again later."
)

router = APIRouter(prefix="/api/v1/consultations", tags=["Consultations"])


class DirectoryUnavailableError(Exception):
    """The directory cannot be read; the cause is logged, never returned."""


def directory_unavailable_response(request: Request, _: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"detail": UNAVAILABLE_MESSAGE, "request_id": request.state.request_id},
        headers={"Cache-Control": "no-store"},
    )


def _contains(term: str):
    """Case-insensitive substring match with LIKE wildcards taken literally."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    listing = models.ConsultationListing
    return or_(
        listing.provider_name.ilike(pattern, escape="\\"),
        listing.specialty.ilike(pattern, escape="\\"),
        listing.area.ilike(pattern, escape="\\"),
    )


def _to_response(row: models.ConsultationListing) -> ConsultationListing:
    return ConsultationListing(
        id=row.id,
        provider_name=row.provider_name,
        provider_type=row.provider_type,
        specialty=row.specialty,
        modes=row.modes,
        area=row.area,
        fee=ConsultationFee(
            state=row.fee_state,
            amount_minor=row.fee_amount_minor,
            currency=row.fee_currency,
            basis=row.fee_basis,
        ),
        access_conditions=row.access_conditions,
        languages=row.languages,
        hours=row.hours,
        notes=row.notes,
        is_fictional=row.source.kind == "fictional_seed",
        source=ConsultationSourceInfo(
            kind=row.source.kind,
            id=row.source.id,
            name=row.source.name,
            version=row.source.version,
            url=row.source.url,
            last_checked_on=row.last_checked_on,
        ),
    )


@router.get(
    "",
    summary="Search and filter the consultation directory",
    responses={
        503: {
            "model": ServiceErrorResponse,
            "description": "The directory database is unavailable or not configured.",
        }
    },
)
def list_consultations(
    request: Request,
    q: Optional[str] = Query(
        None,
        max_length=SEARCH_MAX_LENGTH,
        description=(
            "Search text. Split on whitespace; every term must appear, ignoring "
            "case, in the provider name, specialty or area."
        ),
    ),
    specialty: Optional[str] = Query(
        None,
        min_length=1,
        max_length=60,
        description="Exact specialty, ignoring case. Omit for all specialties.",
    ),
    mode: Optional[ConsultationMode] = Query(
        None, description="Only listings that offer this mode. Omit for all modes."
    ),
    fee_state: Optional[FeeState] = Query(
        None, description="Only listings whose fee is in this state."
    ),
    max_fee_minor: Optional[int] = Query(
        None,
        ge=0,
        le=MAX_FEE_MINOR,
        description=(
            "Inclusive maximum fee in paise (30000 is ₹300). Matches explicit "
            "free listings and known amounts up to the limit; listings with an "
            "unknown fee never match."
        ),
    ),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0, le=MAX_OFFSET),
) -> ConsultationPage:
    """List directory records from PostgreSQL. All filters combine with AND.

    Results are ordered by listing ID. A valid search with no matches returns
    200 with an empty `items` list. Seeded records are fictional.
    """
    listing = models.ConsultationListing
    conditions = [_contains(term) for term in (q or "").split()]
    if specialty is not None:
        conditions.append(func.lower(listing.specialty) == specialty.strip().lower())
    if mode is not None:
        conditions.append(listing.modes.contains([mode.value]))
    if fee_state is not None:
        conditions.append(listing.fee_state == fee_state.value)
    if max_fee_minor is not None:
        # NULL (unknown) amounts fail this comparison; free is stored as 0.
        conditions.append(listing.fee_amount_minor <= max_fee_minor)

    engine = request.app.state.database_engine
    try:
        if engine is None:
            raise DirectoryUnavailableError("MEDASSIST_DATABASE_URL is not set")
        with Session(engine) as session:
            total = session.scalar(
                select(func.count()).select_from(listing).where(*conditions)
            )
            rows = session.scalars(
                select(listing)
                .where(*conditions)
                .order_by(listing.id)
                .limit(limit)
                .offset(offset)
            ).all()
            items = [_to_response(row) for row in rows]
    except (SQLAlchemyError, DirectoryUnavailableError) as error:
        # Stored rows and credentials stay out of the log; the request ID links
        # this line to the client's 503.
        logger.error(
            "consultation directory unavailable request_id=%s cause=%s",
            request.state.request_id,
            type(error).__name__,
        )
        raise DirectoryUnavailableError from error

    return ConsultationPage(items=items, total=total or 0, limit=limit, offset=offset)
