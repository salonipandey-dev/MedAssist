"""Alembic environment. Run from backend: python -m alembic upgrade head

The database URL comes from MEDASSIST_DATABASE_URL. Tests pass their own URL
through config.attributes["database_url"] so they never touch that database.
"""

from alembic import context
from sqlalchemy import create_engine, pool

from app.config import DATABASE_URL_ENV, get_database_url
from app.db import CONNECT_TIMEOUT_SECONDS
from app.models import Base

target_metadata = Base.metadata


def run_migrations() -> None:
    if context.is_offline_mode():
        raise SystemExit("Offline SQL generation is not set up; run against a database.")

    url = context.config.attributes.get("database_url") or get_database_url()
    if url is None:
        raise SystemExit(f"Set {DATABASE_URL_ENV} before running migrations.")

    # Without a timeout the driver can wait indefinitely on an unreachable host.
    engine = create_engine(
        url,
        poolclass=pool.NullPool,
        connect_args={"connect_timeout": CONNECT_TIMEOUT_SECONDS},
    )
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


run_migrations()
