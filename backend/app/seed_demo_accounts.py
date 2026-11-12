"""Create two fictional patient accounts for local development and tests.

    MEDASSIST_ALLOW_DEMO_ACCOUNTS=1 python -m app.seed_demo_accounts [--reset-profiles]

The names, emails, passwords and profile entries below are invented and
published in this repository, so the command refuses to run unless
MEDASSIST_ALLOW_DEMO_ACCOUNTS=1 is set. Never run it against a database that
real people use.

Re-running it is safe: accounts are matched by email and their password hashes
refreshed. Patient A starts with no profile so the empty state can be shown;
Patient B starts with a small fictional profile. Saved profiles are left alone
unless --reset-profiles is given, which puts both back to that starting point
and ends the two accounts' sessions.
"""

from __future__ import annotations

import os
import sys

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import URL, Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import DATABASE_URL_ENV, get_database_url
from app.db import create_database_engine
from app.health_profile import save_profile
from app.models import Account, AuthSession, HealthProfile
from app.schemas import HealthProfileUpdate
from app.security import hash_password

ALLOW_ENV = "MEDASSIST_ALLOW_DEMO_ACCOUNTS"

DEMO_ACCOUNTS = [
    {
        "email": "patient.a@example.test",
        "display_name": "Patient A (fictional)",
        "password": "MedAssist-Demo-A-2026",
    },
    {
        "email": "patient.b@example.test",
        "display_name": "Patient B (fictional)",
        "password": "MedAssist-Demo-B-2026",
    },
]

# Patient B's starting profile shows all three section states.
PATIENT_B_PROFILE = {
    "version": 0,
    "medicines": {
        "state": "recorded",
        "entries": [
            {"name": "Velorin (fictional)", "note": "Invented entry for Patient B"},
        ],
    },
    "allergies": {"state": "none", "entries": []},
    "conditions": {"state": "not_recorded", "entries": []},
}


def seed_demo_accounts(engine: Engine, *, reset_profiles: bool = False) -> dict[str, int]:
    """Upsert the accounts in one transaction; return their IDs by email."""
    ids: dict[str, int] = {}
    with Session(engine) as db, db.begin():
        for account in DEMO_ACCOUNTS:
            password_hash = hash_password(account["password"])
            ids[account["email"]] = db.execute(
                insert(Account)
                .values(
                    email=account["email"],
                    display_name=account["display_name"],
                    role="patient",
                    password_hash=password_hash,
                )
                .on_conflict_do_update(
                    index_elements=["email"],
                    set_={"display_name": account["display_name"], "password_hash": password_hash},
                )
                .returning(Account.id)
            ).scalar_one()

        a_id = ids["patient.a@example.test"]
        b_id = ids["patient.b@example.test"]
        if reset_profiles:
            db.execute(delete(HealthProfile).where(HealthProfile.account_id.in_([a_id, b_id])))
            db.execute(
                update(AuthSession)
                .where(
                    AuthSession.account_id.in_([a_id, b_id]),
                    AuthSession.revoked_at.is_(None),
                )
                .values(revoked_at=func.now())
            )
        has_profile = db.scalar(
            select(HealthProfile.account_id).where(HealthProfile.account_id == b_id)
        )
        if has_profile is None:
            save_profile(db, b_id, HealthProfileUpdate.model_validate(PATIENT_B_PROFILE))
    return ids


def main(argv: list[str]) -> int:
    if os.getenv(ALLOW_ENV, "").strip() != "1":
        print(
            f"Refusing to create demo accounts: set {ALLOW_ENV}=1 to confirm this is a "
            "local development or test database. The demo passwords are public.",
            file=sys.stderr,
        )
        return 2
    unknown = [arg for arg in argv if arg != "--reset-profiles"]
    if unknown:
        print(f"Unknown option: {unknown[0]}", file=sys.stderr)
        return 2
    url: URL | None = get_database_url()
    if url is None:
        print(f"Set {DATABASE_URL_ENV} before seeding.", file=sys.stderr)
        return 2

    engine = create_database_engine(url)
    try:
        seed_demo_accounts(engine, reset_profiles="--reset-profiles" in argv)
    except SQLAlchemyError as error:
        print(
            f"Seeding failed ({type(error).__name__}). Check that PostgreSQL is "
            "running and that 'python -m alembic upgrade head' has been applied.",
            file=sys.stderr,
        )
        return 1
    finally:
        engine.dispose()

    print("Fictional demo accounts are ready (development and tests only):")
    for account in DEMO_ACCOUNTS:
        print(f"  {account['display_name']}: {account['email']} / {account['password']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
