"""Read-only consultation directory backed by PostgreSQL.

The server decides which data it serves. By default that is the fictional demo
seed. With MEDASSIST_CONSULTATION_PILOT=on it serves the imported pilot
listings instead (`?dataset=demo` still returns the fictional demo).

Pilot listings carry the date they were last checked. Once that check is older
than the freshness window they are marked `needs_recheck`, and a listing the
source called free is returned with an unknown fee until it is rechecked. The
same rule is applied in SQL, so the Free filter never returns a stale listing.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import models
from app.config import PilotSettings
from app.consultation_pilot import is_stale, recheck_due_on, stale_before
from app.schemas import (
    ConsultationDataset,
    ConsultationFee,
    ConsultationListing,
    ConsultationMode,
    ConsultationPage,
    ConsultationSourceInfo,
    DatasetSource,
    FeeState,
    ListingVerification,
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


def _verification(
    row: models.ConsultationListing, settings: PilotSettings, as_of: date
) -> ListingVerification:
    if row.source.kind == "fictional_seed" or row.last_checked_on is None:
        return ListingVerification(
            status="fictional_demo",
            checked_on=None,
            recheck_due_on=None,
            free_label_suppressed=False,
        )
    stale = is_stale(row.last_checked_on, as_of, settings.freshness_days)
    return ListingVerification(
        status="needs_recheck" if stale else "current",
        checked_on=row.last_checked_on,
        recheck_due_on=recheck_due_on(row.last_checked_on, settings.freshness_days),
        free_label_suppressed=stale and row.fee_state == "free",
    )


def _to_response(
    row: models.ConsultationListing, settings: PilotSettings, as_of: date
) -> ConsultationListing:
    verification = _verification(row, settings, as_of)
    if verification.free_label_suppressed:
        # Free is only shown while a current source supports it.
        fee = ConsultationFee(state="unknown", amount_minor=None, currency=None, basis=None)
    else:
        fee = ConsultationFee(
            state=row.fee_state,
            amount_minor=row.fee_amount_minor,
            currency=row.fee_currency,
            basis=row.fee_basis,
        )
    return ConsultationListing(
        id=row.id,
        provider_name=row.provider_name,
        provider_type=row.provider_type,
        specialty=row.specialty,
        modes=row.modes,
        area=row.area,
        fee=fee,
        access_conditions=row.access_conditions,
        languages=row.languages,
        hours=row.hours,
        notes=row.notes,
        is_fictional=row.source.kind in models.FICTIONAL_SOURCE_KINDS,
        source=ConsultationSourceInfo(
            kind=row.source.kind,
            id=row.source.id,
            name=row.source.name,
            version=row.source.version,
            url=row.source.url,
            last_checked_on=row.last_checked_on,
            listing_url=row.source_url,
            publisher=row.source.publisher,
            locality=row.source.locality,
            reuse_basis=row.source.reuse_basis,
            reuse_basis_url=row.source.reuse_basis_url,
        ),
        verification=verification,
    )


def _dataset_source(source: models.ConsultationSource) -> DatasetSource:
    return DatasetSource(
        id=source.id,
        kind=source.kind,
        name=source.name,
        version=source.version,
        url=source.url,
        publisher=source.publisher,
        locality=source.locality,
        reuse_basis=source.reuse_basis,
        reuse_basis_url=source.reuse_basis_url,
        imported_at=source.imported_at,
        listing_count=source.listing_count,
    )


@router.get(
    "",
    summary="Search and filter the consultation directory",
    responses={
        404: {"description": "`dataset=pilot` was requested while the pilot is disabled."},
        503: {
            "model": ServiceErrorResponse,
            "description": "The directory database is unavailable or not configured.",
        },
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
    dataset: Optional[Literal["demo", "pilot"]] = Query(
        None,
        description=(
            "Omit to get the server's default: the pilot when it is enabled, otherwise "
            "the fictional demo. `demo` always returns the fictional demo; `pilot` "
            "returns 404 while the pilot is off."
        ),
    ),
) -> ConsultationPage:
    """List directory records from PostgreSQL. All filters combine with AND.

    Results are ordered by listing ID. A valid search with no matches returns
    200 with an empty `items` list. Demo and fixture records are fictional.
    """
    settings: PilotSettings = request.app.state.pilot_settings
    if dataset == "pilot" and not settings.enabled:
        raise HTTPException(404, "The consultation pilot is not enabled on this server.")
    # `mode` is the consultation-mode filter; this is which data is served.
    served = dataset or ("pilot" if settings.enabled else "demo")
    kinds = ("fictional_seed",) if served == "demo" else models.PILOT_SOURCE_KINDS
    as_of = settings.as_of()

    listing = models.ConsultationListing
    stale = and_(
        listing.last_checked_on.is_not(None),
        listing.last_checked_on < stale_before(as_of, settings.freshness_days),
    )
    stale_free = and_(listing.fee_state == "free", stale)
    conditions = [listing.source_kind.in_(kinds)]
    conditions += [_contains(term) for term in (q or "").split()]
    if specialty is not None:
        conditions.append(func.lower(listing.specialty) == specialty.strip().lower())
    if mode is not None:
        conditions.append(listing.modes.contains([mode.value]))
    # A stale "free" listing is served as unknown, so it is filtered as unknown.
    if fee_state is FeeState.free:
        conditions += [listing.fee_state == "free", not_(stale_free)]
    elif fee_state is FeeState.unknown:
        conditions.append(or_(listing.fee_state == "unknown", stale_free))
    elif fee_state is FeeState.known:
        conditions.append(listing.fee_state == "known")
    if max_fee_minor is not None:
        # NULL (unknown) amounts fail this comparison; free is stored as 0.
        conditions += [listing.fee_amount_minor <= max_fee_minor, not_(stale_free)]

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
            items = [_to_response(row, settings, as_of) for row in rows]
            specialties = session.scalars(
                select(listing.specialty)
                .where(listing.source_kind.in_(kinds))
                .distinct()
                .order_by(listing.specialty)
            ).all()
            sources = [
                _dataset_source(source)
                for source in session.scalars(
                    select(models.ConsultationSource)
                    .where(models.ConsultationSource.kind.in_(kinds))
                    .order_by(models.ConsultationSource.id)
                ).all()
            ]
    except (SQLAlchemyError, DirectoryUnavailableError) as error:
        # Stored rows and credentials stay out of the log; the request ID links
        # this line to the client's 503.
        logger.error(
            "consultation directory unavailable request_id=%s cause=%s",
            request.state.request_id,
            type(error).__name__,
        )
        raise DirectoryUnavailableError from error

    return ConsultationPage(
        items=items,
        total=total or 0,
        limit=limit,
        offset=offset,
        dataset=ConsultationDataset(
            mode=served,
            pilot_enabled=settings.enabled,
            freshness_days=settings.freshness_days,
            as_of=as_of,
            specialties=list(specialties),
            sources=sources,
        ),
    )
