"""Database tables for the consultation directory.

The constraints here mirror migrations/versions/0001_consultation_directory.py.
Change the schema with a new migration, then update these models to match.
"""

from __future__ import annotations

from datetime import date
from typing import List, Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKeyConstraint,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

PROVIDER_TYPES = ("clinic", "hospital_outpatient", "teleconsultation", "community_camp")
CONSULTATION_MODES = ("in_person", "video", "phone")
FEE_STATES = ("known", "free", "unknown")
SOURCE_KINDS = ("fictional_seed", "reviewed_external")

# One row is exactly one of: a known positive amount, an explicit free listing
# with a stated basis, or unknown with no amount at all. The IS NOT NULL tests
# matter: a CHECK passes when its expression is NULL.
FEE_STATE_CHECK = (
    "(fee_state = 'known' AND fee_amount_minor IS NOT NULL"
    " AND fee_amount_minor > 0 AND fee_currency IS NOT NULL AND fee_currency = 'INR'"
    " AND fee_basis IS NOT NULL AND btrim(fee_basis) <> '')"
    " OR (fee_state = 'free' AND fee_amount_minor IS NOT NULL"
    " AND fee_amount_minor = 0 AND fee_currency IS NOT NULL AND fee_currency = 'INR'"
    " AND fee_basis IS NOT NULL AND btrim(fee_basis) <> '')"
    " OR (fee_state = 'unknown' AND fee_amount_minor IS NULL"
    " AND fee_currency IS NULL AND fee_basis IS NULL)"
)


def _in_list(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


def _array_subset(column: str, values: tuple[str, ...]) -> str:
    allowed = ", ".join(repr(value) for value in values)
    return f"cardinality({column}) >= 1 AND {column} <@ ARRAY[{allowed}]::text[]"


class Base(DeclarativeBase):
    pass


class ConsultationSource(Base):
    __tablename__ = "consultation_sources"
    __table_args__ = (
        CheckConstraint(_in_list("kind", SOURCE_KINDS), name="ck_consultation_sources_kind"),
        CheckConstraint(
            "btrim(name) <> '' AND btrim(version) <> ''",
            name="ck_consultation_sources_not_blank",
        ),
        CheckConstraint(
            "kind <> 'fictional_seed' OR url IS NULL",
            name="ck_consultation_sources_fictional_has_no_url",
        ),
        UniqueConstraint("id", "kind", name="uq_consultation_sources_id_kind"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    kind: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    version: Mapped[str] = mapped_column(Text)
    url: Mapped[Optional[str]] = mapped_column(Text)


class ConsultationListing(Base):
    __tablename__ = "consultation_listings"
    __table_args__ = (
        CheckConstraint(
            "id ~ '^[a-z0-9][a-z0-9-]{0,63}$'", name="ck_consultation_listings_id_format"
        ),
        CheckConstraint(
            "btrim(provider_name) <> '' AND btrim(specialty) <> '' AND btrim(area) <> ''",
            name="ck_consultation_listings_not_blank",
        ),
        CheckConstraint(
            _in_list("provider_type", PROVIDER_TYPES),
            name="ck_consultation_listings_provider_type",
        ),
        CheckConstraint(
            _array_subset("modes", CONSULTATION_MODES), name="ck_consultation_listings_modes"
        ),
        CheckConstraint(
            _in_list("fee_state", FEE_STATES), name="ck_consultation_listings_fee_state"
        ),
        CheckConstraint(FEE_STATE_CHECK, name="ck_consultation_listings_fee_consistent"),
        CheckConstraint(
            "source_kind <> 'fictional_seed' OR last_checked_on IS NULL",
            name="ck_consultation_listings_fictional_not_verified",
        ),
        # Carrying the kind through the key lets the check above see it.
        ForeignKeyConstraint(
            ["source_id", "source_kind"],
            ["consultation_sources.id", "consultation_sources.kind"],
            name="fk_consultation_listings_source",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    provider_name: Mapped[str] = mapped_column(Text)
    provider_type: Mapped[str] = mapped_column(Text)
    specialty: Mapped[str] = mapped_column(Text)
    area: Mapped[str] = mapped_column(Text)
    modes: Mapped[List[str]] = mapped_column(ARRAY(Text))
    fee_state: Mapped[str] = mapped_column(Text)
    fee_amount_minor: Mapped[Optional[int]] = mapped_column(Integer)
    fee_currency: Mapped[Optional[str]] = mapped_column(Text)
    fee_basis: Mapped[Optional[str]] = mapped_column(Text)
    access_conditions: Mapped[Optional[str]] = mapped_column(Text)
    languages: Mapped[List[str]] = mapped_column(ARRAY(Text))
    hours: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    source_id: Mapped[str] = mapped_column(Text)
    source_kind: Mapped[str] = mapped_column(Text)
    last_checked_on: Mapped[Optional[date]] = mapped_column(Date)

    source: Mapped[ConsultationSource] = relationship(lazy="joined", innerjoin=True)
