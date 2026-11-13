"""Environment settings for the browser frontend, the database, sign-in sessions
and the consultation pilot."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo
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


SESSION_IDLE_MINUTES_ENV = "MEDASSIST_SESSION_IDLE_MINUTES"
SESSION_MAX_HOURS_ENV = "MEDASSIST_SESSION_MAX_HOURS"
COOKIE_SECURE_ENV = "MEDASSIST_COOKIE_SECURE"


@dataclass(frozen=True)
class SessionSettings:
    """How long a sign-in lasts and how its cookie is sent.

    A session ends after `idle_minutes` without a request, or `max_hours` after
    sign-in, whichever comes first. `always_secure` forces the Secure cookie
    attribute when TLS ends at a proxy and the API itself sees plain HTTP;
    otherwise the attribute follows the request scheme.
    """

    idle_minutes: int = 30
    max_hours: int = 8
    always_secure: bool = False


def _bounded_int(variable: str, default: int, low: int, high: int) -> int:
    value = os.getenv(variable, "").strip()
    if not value:
        return default
    if not value.isdigit() or not low <= int(value) <= high:
        raise ValueError(f"{variable} must be a whole number from {low} to {high}.")
    return int(value)


def get_session_settings() -> SessionSettings:
    secure = os.getenv(COOKIE_SECURE_ENV, "").strip().lower()
    if secure not in {"", "auto", "true"}:
        raise ValueError(
            f"{COOKIE_SECURE_ENV} must be 'auto' (Secure on HTTPS requests) or 'true' "
            "(always Secure, for an API behind a TLS-terminating proxy)."
        )
    return SessionSettings(
        idle_minutes=_bounded_int(SESSION_IDLE_MINUTES_ENV, 30, 1, 24 * 60),
        max_hours=_bounded_int(SESSION_MAX_HOURS_ENV, 8, 1, 7 * 24),
        always_secure=secure == "true",
    )


CONSULTATION_PILOT_ENV = "MEDASSIST_CONSULTATION_PILOT"
PILOT_FRESHNESS_DAYS_ENV = "MEDASSIST_PILOT_FRESHNESS_DAYS"
PILOT_AS_OF_ENV = "MEDASSIST_PILOT_AS_OF"
# Dates are judged in India, where the pilot locality is.
PILOT_TIME_ZONE = ZoneInfo("Asia/Kolkata")


@dataclass(frozen=True)
class PilotSettings:
    """Whether the consultation directory serves pilot listings, and how old a
    listing's last check may be before it shows "Needs recheck".

    The pilot is off unless MEDASSIST_CONSULTATION_PILOT=on; then only the
    fictional demo is served. MEDASSIST_PILOT_AS_OF pins "today" for tests and
    demonstrations so a fixed fixture keeps the same freshness.
    """

    enabled: bool = False
    freshness_days: int = 90
    as_of_override: Optional[date] = None

    def as_of(self) -> date:
        return self.as_of_override or datetime.now(PILOT_TIME_ZONE).date()


def get_pilot_settings() -> PilotSettings:
    flag = os.getenv(CONSULTATION_PILOT_ENV, "").strip().lower()
    if flag not in {"", "off", "on"}:
        raise ValueError(f"{CONSULTATION_PILOT_ENV} must be 'on' or 'off' (the default).")
    as_of_text = os.getenv(PILOT_AS_OF_ENV, "").strip()
    try:
        as_of = date.fromisoformat(as_of_text) if as_of_text else None
    except ValueError:
        raise ValueError(f"{PILOT_AS_OF_ENV} must be a date like 2026-11-13.") from None
    return PilotSettings(
        enabled=flag == "on",
        freshness_days=_bounded_int(PILOT_FRESHNESS_DAYS_ENV, 90, 1, 365),
        as_of_override=as_of,
    )
