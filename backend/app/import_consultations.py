"""Import a consultation pilot dataset into PostgreSQL.

    python -m app.import_consultations PATH/TO/dataset.json

The file format is described in app/consultation_pilot.py and
docs/CONSULTATION_PILOT.md. The whole file is validated first; then, in one
transaction that holds an advisory lock:

1. the source row is created or updated (its kind can never change);
2. listings of this source that are no longer in the file are removed;
3. every listing is inserted or updated by its stable ID (an ID that belongs to
   another source stops the import);
4. the source's import record (file hash, time, listing count) is written.

Importing the same file again leaves the same rows and IDs. If anything fails,
the transaction rolls back: the last successful dataset, including every
listing's check date, stays exactly as it was.
"""

from __future__ import annotations

import hashlib
import json
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Optional

from pydantic import ValidationError
from sqlalchemy import delete, func, literal_column, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import DATABASE_URL_ENV, get_database_url, get_pilot_settings
from app.consultation_pilot import PilotDataset
from app.db import create_database_engine
from app.models import ConsultationListing, ConsultationSource

# Any fixed number works; it only has to be the same for every import.
IMPORT_LOCK_KEY = 4_861_206


class ImportRejected(Exception):
    """The dataset cannot be imported; nothing was changed."""


@dataclass(frozen=True)
class ImportSummary:
    source_id: str
    listings: int
    inserted: int
    updated: int
    removed: int
    sha256: str


def load_dataset(path: Path, today: date) -> tuple[PilotDataset, str]:
    raw = path.read_bytes()
    try:
        dataset = PilotDataset.model_validate(json.loads(raw.decode("utf-8")))
        dataset.check_dates(today)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ImportRejected(f"{path.name} is not UTF-8 JSON: {error}") from None
    except (ValidationError, ValueError) as error:
        raise ImportRejected(f"{path.name} is not a valid pilot dataset:\n{error}") from None
    return dataset, hashlib.sha256(raw).hexdigest()


def _listing_row(dataset: PilotDataset, listing) -> dict:
    return {
        "id": listing.id,
        "provider_name": listing.provider_name,
        "provider_type": listing.provider_type,
        "specialty": listing.specialty,
        "area": listing.area,
        "modes": list(listing.modes),
        "fee_state": listing.fee.state,
        "fee_amount_minor": listing.fee.amount_minor,
        "fee_currency": None if listing.fee.state == "unknown" else "INR",
        "fee_basis": listing.fee.basis,
        "access_conditions": listing.access_conditions,
        "languages": list(listing.languages),
        "hours": listing.hours,
        "notes": listing.notes,
        "source_id": dataset.source.id,
        "source_kind": dataset.source.kind,
        "last_checked_on": listing.last_checked_on,
        "source_url": listing.source_url,
    }


def _record_import(db: Session, dataset: PilotDataset, sha256: str) -> None:
    """Final step: mark this file as the source's last successful import."""
    db.execute(
        update(ConsultationSource)
        .where(ConsultationSource.id == dataset.source.id)
        .values(
            dataset_sha256=sha256, imported_at=func.now(), listing_count=len(dataset.listings)
        )
    )


def import_dataset(engine: Engine, dataset: PilotDataset, sha256: str) -> ImportSummary:
    source = dataset.source
    ids = [listing.id for listing in dataset.listings]
    with Session(engine) as db, db.begin():
        # One import at a time; a second waits instead of interleaving.
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": IMPORT_LOCK_KEY})

        saved = db.execute(
            insert(ConsultationSource)
            .values(
                id=source.id,
                kind=source.kind,
                name=source.name,
                version=source.version,
                url=source.url,
                publisher=source.publisher,
                locality=source.locality,
                reuse_basis=source.reuse_basis,
                reuse_basis_url=source.reuse_basis_url,
            )
            .on_conflict_do_update(
                index_elements=["id"],
                set_={
                    "name": source.name,
                    "version": source.version,
                    "url": source.url,
                    "publisher": source.publisher,
                    "locality": source.locality,
                    "reuse_basis": source.reuse_basis,
                    "reuse_basis_url": source.reuse_basis_url,
                },
                where=ConsultationSource.kind == source.kind,
            )
            .returning(ConsultationSource.id)
        ).scalar_one_or_none()
        if saved is None:
            raise ImportRejected(
                f"source {source.id} already exists with a different kind; "
                "a fixture can never become a reviewed source or the reverse"
            )

        removed = db.execute(
            delete(ConsultationListing)
            .where(ConsultationListing.source_id == source.id, ConsultationListing.id.not_in(ids))
            .returning(ConsultationListing.id)
        ).all()

        inserted = updated = 0
        clashes = []
        for listing in dataset.listings:
            row = _listing_row(dataset, listing)
            statement = insert(ConsultationListing).values(**row)
            result = db.execute(
                statement.on_conflict_do_update(
                    index_elements=["id"],
                    set_={key: statement.excluded[key] for key in row if key != "id"},
                    # Never take over a listing that belongs to another source.
                    where=ConsultationListing.source_id == source.id,
                # xmax is 0 for a freshly inserted row and set for an updated one.
                ).returning(literal_column("(xmax = 0)").label("inserted"))
            ).one_or_none()
            if result is None:
                clashes.append(listing.id)
            elif result.inserted:
                inserted += 1
            else:
                updated += 1
        if clashes:
            raise ImportRejected(
                "listing IDs already belong to another source: " + ", ".join(clashes)
            )

        _record_import(db, dataset, sha256)
    return ImportSummary(
        source_id=source.id,
        listings=len(ids),
        inserted=inserted,
        updated=updated,
        removed=len(removed),
        sha256=sha256,
    )


def current_listing_ids(engine: Engine, source_id: str) -> list[str]:
    with Session(engine) as db:
        return list(
            db.scalars(
                select(ConsultationListing.id)
                .where(ConsultationListing.source_id == source_id)
                .order_by(ConsultationListing.id)
            )
        )


def main(argv: list[str]) -> int:
    if len(argv) != 1 or argv[0].startswith("-"):
        print("Usage: python -m app.import_consultations PATH/TO/dataset.json", file=sys.stderr)
        return 2
    url = get_database_url()
    if url is None:
        print(f"Set {DATABASE_URL_ENV} before importing.", file=sys.stderr)
        return 2
    try:
        today = get_pilot_settings().as_of()
        dataset, sha256 = load_dataset(Path(argv[0]), today)
    except (OSError, ValueError, ImportRejected) as error:
        print(f"Import refused, nothing changed. {error}", file=sys.stderr)
        return 1

    engine = create_database_engine(url)
    summary: Optional[ImportSummary] = None
    try:
        summary = import_dataset(engine, dataset, sha256)
    except ImportRejected as error:
        print(f"Import refused, nothing changed. {error}", file=sys.stderr)
    except SQLAlchemyError as error:
        print(
            f"Import failed and was rolled back ({type(error).__name__}); the previous "
            "dataset is unchanged. Check that PostgreSQL is running and migrated.",
            file=sys.stderr,
        )
    finally:
        engine.dispose()
    if summary is None:
        return 1

    label = "FICTIONAL TEST FIXTURE" if dataset.source.kind == "pilot_fixture" else "reviewed"
    print(
        f"Imported {summary.listings} listings from {summary.source_id} ({label}): "
        f"{summary.inserted} new, {summary.updated} updated, {summary.removed} removed. "
        f"sha256 {summary.sha256[:12]}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
