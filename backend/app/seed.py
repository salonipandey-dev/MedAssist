"""Seed the fictional consultation directory.

Run from backend after migrating:  python -m app.seed

Every provider, area and fee below is invented and mirrors the frontend
fixtures in frontend/src/data/mock/consultations.ts. The command is safe to
repeat: rows are upserted by their stable ID inside one transaction, so a
second run changes nothing and a failed run changes nothing.
"""

from __future__ import annotations

import sys

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import URL, Engine
from sqlalchemy.exc import SQLAlchemyError

from app.config import DATABASE_URL_ENV, get_database_url
from app.db import create_database_engine
from app.models import ConsultationListing, ConsultationSource

FICTIONAL_SOURCE = {
    "id": "medassist-fictional-seed",
    "kind": "fictional_seed",
    "name": "MedAssist fictional demonstration directory",
    "version": "1.0.0",
    "url": None,
}

_FIRST_VISIT = "Illustrative fee for a first consultation."
_FREE_BASIS = (
    "Shown as free for demonstration only. "
    "A real free service would need a verified source."
)


def _listing(
    listing_id: str,
    provider_name: str,
    provider_type: str,
    specialty: str,
    modes: list[str],
    area: str,
    languages: list[str],
    hours: str | None,
    notes: str,
    *,
    fee_inr: int | None = None,
    fee_basis: str | None = None,
    access_conditions: str | None = None,
) -> dict:
    """fee_inr None with no basis is unknown; 0 is explicit free; else known."""
    if fee_inr is None:
        fee = {"fee_state": "unknown", "fee_amount_minor": None, "fee_currency": None}
    else:
        fee = {
            "fee_state": "free" if fee_inr == 0 else "known",
            "fee_amount_minor": fee_inr * 100,
            "fee_currency": "INR",
        }
    return {
        "id": listing_id,
        "provider_name": provider_name,
        "provider_type": provider_type,
        "specialty": specialty,
        "modes": modes,
        "area": area,
        **fee,
        "fee_basis": fee_basis,
        "access_conditions": access_conditions,
        "languages": languages,
        "hours": hours,
        "notes": notes,
        "source_id": FICTIONAL_SOURCE["id"],
        "source_kind": FICTIONAL_SOURCE["kind"],
        "last_checked_on": None,
    }


FICTIONAL_LISTINGS = [
    _listing(
        "c-01",
        "Riverside Family Clinic (fictional)",
        "clinic",
        "General practice",
        ["in_person"],
        "Riverside, Sample City",
        ["English", "Hindi"],
        "Weekdays · morning and evening (illustrative)",
        "Illustrative fee for a first consultation.",
        fee_inr=300,
        fee_basis=_FIRST_VISIT,
    ),
    _listing(
        "c-02",
        "Lakeview Teleconsult (fictional)",
        "teleconsultation",
        "General practice",
        ["video", "phone"],
        "Remote only",
        ["English", "Hindi"],
        "Daily · 08:00–20:00 (illustrative)",
        "Remote consultation; some concerns would need an in-person visit.",
        fee_inr=199,
        fee_basis="Illustrative fee for one remote consultation.",
        access_conditions="Remote only; some concerns would need an in-person visit.",
    ),
    _listing(
        "c-03",
        "Sample Community Health Camp (fictional)",
        "community_camp",
        "General practice",
        ["in_person"],
        "Old Market, Sample City",
        ["Hindi"],
        "First Saturday of the month (illustrative)",
        _FREE_BASIS,
        fee_inr=0,
        fee_basis=_FREE_BASIS,
        access_conditions="Fictional example: walk-in on camp days only.",
    ),
    _listing(
        "c-04",
        "Northgate Hospital Outpatients (fictional)",
        "hospital_outpatient",
        "Internal medicine",
        ["in_person"],
        "Northgate, Sample City",
        ["English", "Hindi"],
        "Weekdays · morning (illustrative)",
        "Illustrative registration and consultation fee.",
        fee_inr=500,
        fee_basis="Illustrative registration and consultation fee.",
    ),
    _listing(
        "c-05",
        "Meadow Skin Clinic (fictional)",
        "clinic",
        "Dermatology",
        ["in_person", "video"],
        "Meadow Park, Sample City",
        ["English"],
        "Tuesday to Saturday (illustrative)",
        "Video follow-ups shown for demonstration.",
        fee_inr=600,
        fee_basis=_FIRST_VISIT,
    ),
    _listing(
        "c-06",
        "Little Steps Children’s Clinic (fictional)",
        "clinic",
        "Paediatrics",
        ["in_person"],
        "Riverside, Sample City",
        ["English", "Hindi"],
        None,
        "No fee information in the sample record.",
    ),
    _listing(
        "c-07",
        "Harbour ENT Centre (fictional)",
        "clinic",
        "ENT",
        ["in_person"],
        "Harbour Road, Sample City",
        ["English"],
        "Weekdays · afternoon (illustrative)",
        "Illustrative fee for a first consultation.",
        fee_inr=450,
        fee_basis=_FIRST_VISIT,
    ),
    _listing(
        "c-08",
        "Civic Polyclinic OPD (fictional)",
        "hospital_outpatient",
        "Internal medicine",
        ["in_person"],
        "Civic Centre, Sample City",
        ["Hindi", "English"],
        "Weekdays · morning (illustrative)",
        _FREE_BASIS,
        fee_inr=0,
        fee_basis=_FREE_BASIS,
        access_conditions="Fictional example: morning outpatient registration.",
    ),
    _listing(
        "c-09",
        "Brightline Online Dermatology (fictional)",
        "teleconsultation",
        "Dermatology",
        ["video"],
        "Remote only",
        ["English"],
        None,
        "No fee information in the sample record.",
    ),
]


def _upsert(connection, table, rows: list[dict]) -> None:
    statement = insert(table).values(rows)
    # Only the columns the seed writes: the seed also runs on a database at
    # revision 0001, before later migrations add columns (such as the pilot's).
    updates = {
        name: statement.excluded[name]
        for name in rows[0]
        if not table.columns[name].primary_key
    }
    connection.execute(
        statement.on_conflict_do_update(index_elements=["id"], set_=updates)
    )


def seed(engine: Engine) -> int:
    """Upsert the fictional records; return the listing count afterwards."""
    with engine.begin() as connection:
        _upsert(connection, ConsultationSource.__table__, [FICTIONAL_SOURCE])
        _upsert(connection, ConsultationListing.__table__, FICTIONAL_LISTINGS)
        return connection.scalar(
            select(func.count()).select_from(ConsultationListing.__table__)
        )


def seed_database(url: URL) -> int:
    engine = create_database_engine(url)
    try:
        return seed(engine)
    finally:
        engine.dispose()


def main() -> int:
    url = get_database_url()
    if url is None:
        print(f"Set {DATABASE_URL_ENV} before seeding.", file=sys.stderr)
        return 2
    try:
        total = seed_database(url)
    except SQLAlchemyError as error:
        # The driver message can name the host and user, so only the kind of
        # failure is printed.
        print(
            f"Seeding failed ({type(error).__name__}). Check that PostgreSQL is "
            "running and that 'python -m alembic upgrade head' has been applied.",
            file=sys.stderr,
        )
        return 1
    print(
        f"Seeded {len(FICTIONAL_LISTINGS)} fictional consultation listings; "
        f"the directory now holds {total}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
