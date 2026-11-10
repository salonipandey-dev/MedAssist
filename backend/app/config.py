"""Environment settings for the browser frontend and the database."""

from __future__ import annotations

import os
from urllib.parse import urlsplit

from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError


def get_cors_origins() -> list[str]:
    """Read exact HTTP(S) origins; cross-origin access is disabled by default."""
    origins = []
    for value in os.getenv("MEDASSIST_CORS_ORIGINS", "").split(","):
        origin = value.strip()
        if not origin:
            continue

        try:
            parsed = urlsplit(origin)
            # Accessing port also checks for non-numeric and out-of-range ports.
            parsed.port
            valid = (
                parsed.scheme in {"http", "https"}
                and parsed.hostname
                and parsed.username is None
                and parsed.password is None
                and origin == f"{parsed.scheme}://{parsed.netloc}"
                and not parsed.netloc.endswith(":")
                and "*" not in origin
                and not any(char.isspace() or ord(char) < 32 for char in origin)
            )
        except ValueError:
            valid = False

        if not valid:
            raise ValueError(
                "MEDASSIST_CORS_ORIGINS must contain comma-separated HTTP(S) "
                "origins without paths, credentials, or wildcards. "
                "Example: http://localhost:5173"
            )
        if origin not in origins:
            origins.append(origin)

    return origins


DATABASE_URL_ENV = "MEDASSIST_DATABASE_URL"
TEST_DATABASE_URL_ENV = "MEDASSIST_TEST_DATABASE_URL"
_POSTGRES_DRIVERS = {"postgresql", "postgres", "postgresql+psycopg"}


def get_database_url(variable: str = DATABASE_URL_ENV) -> URL | None:
    """Read a PostgreSQL URL; None means no database has been configured.

    The value holds credentials, so configuration errors never repeat it.
    """
    value = os.getenv(variable, "").strip()
    if not value:
        return None

    try:
        url = make_url(value)
    except ArgumentError:
        url = None

    if url is None or url.drivername not in _POSTGRES_DRIVERS or not url.database:
        raise ValueError(
            f"{variable} must be a PostgreSQL URL that names a database. "
            "Example: postgresql://USER:PASSWORD@localhost:5432/medassist"
        )
    return url.set(drivername="postgresql+psycopg")
