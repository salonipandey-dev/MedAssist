"""Run the fictional demo medication rules against your own saved profile.

Read-only: the profile is loaded on the server for the session's account, so
the browser never sends entries to check and cannot choose whose profile is
used. The rules live in app/medication_rules.py.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.auth import authenticate
from app.health_profile import load_profile
from app.medication_rules import evaluate
from app.schemas import ApiErrorResponse, MedicationCheckResponse
from app.security import check_request_origin, reject_query_parameters, transaction

router = APIRouter(
    prefix="/api/v1/me",
    tags=["Medication check"],
    dependencies=[Depends(check_request_origin), Depends(reject_query_parameters)],
)


@router.get(
    "/medication-check",
    summary="Check your saved profile against the fictional demo rules",
    responses={
        401: {"model": ApiErrorResponse, "description": "Not signed in, or the session ended."},
        503: {"description": "The account database is unavailable."},
    },
)
def medication_check(request: Request) -> MedicationCheckResponse:
    """Return which demo rules matched the saved medicines, allergies and
    conditions, which entries the demo dataset could not recognise, and which
    sections are not recorded. Every rule and product is fictional; a result is
    never a statement that a real combination is safe or unsafe."""
    with transaction(request) as db:
        current = authenticate(request, db)
        profile = load_profile(db, current.account_id)
    return evaluate(profile)
