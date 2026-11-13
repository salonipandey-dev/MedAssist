"""The consultation pilot's import file format and freshness rules.

A pilot dataset is a JSON file with one source and its listings. It is fully
validated here before the importer (app/import_consultations.py) touches the
database, so a file that fails validation changes nothing.

Two source kinds can be imported:

- `reviewed_external`: listings checked by hand against an approved official
  source. URLs may not point at example domains.
- `pilot_fixture`: clearly fictional test records with the same shape, used to
  prove the import and the screens. Their URLs must be on example.org,
  example.com or example.net, and every provider name must say "(fictional)".

This module imports only pydantic, so it can be checked without a database.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated, List, Literal, Optional
from urllib.parse import urlsplit

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator

FORMAT = "medassist-consultation-pilot/1"
LISTING_ID_PATTERN = r"^[a-z0-9][a-z0-9-]{0,63}$"
MAX_LISTINGS = 200
EXAMPLE_HOST = re.compile(r"^([a-z0-9-]+\.)*example\.(org|com|net)$")

PROVIDER_TYPES = ("clinic", "hospital_outpatient", "teleconsultation", "community_camp")
MODES = ("in_person", "video", "phone")


def _https_url(value: str) -> str:
    parts = urlsplit(value)
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
        raise ValueError("must be an https:// URL without credentials")
    return value


HttpsUrl = Annotated[str, AfterValidator(_https_url)]


def is_example_url(value: str) -> bool:
    return bool(EXAMPLE_HOST.match((urlsplit(value).hostname or "").lower()))


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class PilotFee(_Strict):
    """`known`: an amount the source lists. `free`: the source explicitly says
    free. `unknown`: the source gives no price (shown as "Fee not listed")."""

    state: Literal["known", "free", "unknown"]
    amount_inr: Optional[Decimal] = Field(default=None, gt=0, le=1_000_000)
    basis: Optional[str] = Field(default=None, min_length=1, max_length=300)

    @model_validator(mode="after")
    def check_state(self) -> "PilotFee":
        if self.state == "known":
            if self.amount_inr is None or not self.basis:
                raise ValueError("a known fee needs amount_inr and the basis the source gives")
            if self.amount_inr.as_tuple().exponent < -2:
                raise ValueError("amount_inr can have at most two decimal places")
        elif self.state == "free":
            if self.amount_inr is not None or not self.basis:
                raise ValueError("a free fee needs the basis the source gives and no amount")
        elif self.amount_inr is not None or self.basis is not None:
            raise ValueError("an unknown fee has no amount and no basis")
        return self

    @property
    def amount_minor(self) -> Optional[int]:
        if self.state == "free":
            return 0
        return None if self.amount_inr is None else int(self.amount_inr * 100)


class PilotListing(_Strict):
    id: str = Field(pattern=LISTING_ID_PATTERN)
    provider_name: str = Field(min_length=1, max_length=160)
    provider_type: Literal["clinic", "hospital_outpatient", "teleconsultation", "community_camp"]
    specialty: str = Field(min_length=1, max_length=60)
    area: str = Field(min_length=1, max_length=160)
    modes: List[Literal["in_person", "video", "phone"]] = Field(min_length=1)
    fee: PilotFee
    access_conditions: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=400,
        description="Eligibility or access conditions exactly as the source states them.",
    )
    languages: List[str] = []
    hours: Optional[str] = Field(default=None, min_length=1, max_length=160)
    notes: Optional[str] = Field(default=None, min_length=1, max_length=400)
    source_url: HttpsUrl = Field(description="The page this listing was checked against.")
    last_checked_on: date = Field(description="The date someone last checked the listing.")

    @field_validator("modes")
    @classmethod
    def unique_modes(cls, value: List[str]) -> List[str]:
        if len(set(value)) != len(value):
            raise ValueError("modes must not repeat")
        return value


class PilotSource(_Strict):
    id: str = Field(pattern=LISTING_ID_PATTERN)
    kind: Literal["reviewed_external", "pilot_fixture"]
    name: str = Field(min_length=1, max_length=160)
    version: str = Field(min_length=1, max_length=40)
    url: HttpsUrl = Field(description="The source's main page.")
    publisher: str = Field(min_length=1, max_length=160)
    locality: str = Field(min_length=1, max_length=120)
    reuse_basis: str = Field(
        min_length=1,
        max_length=600,
        description="Why MedAssist may reuse this data: the licence or permission relied on.",
    )
    reuse_basis_url: Optional[HttpsUrl] = None


class PilotDataset(_Strict):
    format: Literal["medassist-consultation-pilot/1"]
    source: PilotSource
    listings: List[PilotListing] = Field(min_length=1, max_length=MAX_LISTINGS)

    @model_validator(mode="after")
    def check_dataset(self) -> "PilotDataset":
        ids = [listing.id for listing in self.listings]
        if len(ids) != len(set(ids)):
            raise ValueError("listing IDs must be unique")
        urls = [self.source.url, *(listing.source_url for listing in self.listings)]
        if self.source.reuse_basis_url:
            urls.append(self.source.reuse_basis_url)
        if self.source.kind == "pilot_fixture":
            if not all(is_example_url(url) for url in urls):
                raise ValueError("pilot_fixture URLs must be on example.org, .com or .net")
            unlabelled = [
                item.id for item in self.listings if "(fictional)" not in item.provider_name
            ]
            if unlabelled or "(fictional)" not in self.source.name:
                raise ValueError(
                    "pilot_fixture source and provider names must say (fictional): "
                    + ", ".join(unlabelled or [self.source.id])
                )
        elif any(is_example_url(url) for url in urls):
            raise ValueError("reviewed_external data cannot use example.* URLs")
        return self

    def check_dates(self, today: date) -> None:
        """Refuse check dates in the future: they would look fresh for too long."""
        future = [listing.id for listing in self.listings if listing.last_checked_on > today]
        if future:
            raise ValueError(f"last_checked_on is after {today} for: {', '.join(future)}")


# --- Freshness -----------------------------------------------------------------


def recheck_due_on(checked_on: date, freshness_days: int) -> date:
    """The last day a check still counts as current."""
    return checked_on + timedelta(days=freshness_days)


def is_stale(checked_on: date, as_of: date, freshness_days: int) -> bool:
    return as_of > recheck_due_on(checked_on, freshness_days)


def stale_before(as_of: date, freshness_days: int) -> date:
    """Listings checked before this date need rechecking (for SQL filters)."""
    return as_of - timedelta(days=freshness_days)
