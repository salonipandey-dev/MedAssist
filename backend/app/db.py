"""PostgreSQL engine settings. Creating an engine does not open a connection."""

from sqlalchemy import create_engine
from sqlalchemy.engine import URL, Engine

CONNECT_TIMEOUT_SECONDS = 5
STATEMENT_TIMEOUT_MS = 5000


def create_database_engine(url: URL) -> Engine:
    """Build a small pool that fails fast when PostgreSQL is unreachable.

    Connections are opened only when a route asks for one, so the system
    endpoints keep responding while the database is down. Bound values (such
    as profile entries or password hashes) are left out of SQLAlchemy's log
    lines and error messages.
    """
    return create_engine(
        url,
        hide_parameters=True,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_timeout=CONNECT_TIMEOUT_SECONDS,
        connect_args={
            "connect_timeout": CONNECT_TIMEOUT_SECONDS,
            "options": f"-c statement_timeout={STATEMENT_TIMEOUT_MS}",
        },
    )
