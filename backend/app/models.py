"""Database tables for the consultation directory, accounts and health profiles.

The constraints here mirror the migrations in migrations/versions/: 0001 for the
directory, 0002 for accounts, sessions and health profiles. Change the schema
with a new migration, then update these models to match.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Identity,
    Index,
    Integer,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
    text,
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


# --- Accounts, sessions and private health profiles (migration 0002) ---------

ACCOUNT_ROLES = ("patient",)
# PROFILE_SECTIONS and the limits below are re-exported for existing imports.
from app.limits import (  # noqa: E402
    ENTRIES_PER_SECTION_MAX,
    ENTRY_NAME_MAX,
    ENTRY_NOTE_MAX,
    PROFILE_SECTIONS,
    SECTION_STATES,
)


class Account(Base):
    """A person who can sign in. Only fictional patients exist in this prototype."""

    __tablename__ = "accounts"
    __table_args__ = (
        CheckConstraint(
            "email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254"
            " AND position('@' in email) > 1",
            name="ck_accounts_email_normalized",
        ),
        CheckConstraint(
            "btrim(display_name) <> '' AND length(display_name) <= 80",
            name="ck_accounts_display_name",
        ),
        CheckConstraint(_in_list("role", ACCOUNT_ROLES), name="ck_accounts_role"),
        CheckConstraint(
            "password_hash LIKE '$argon2id$%'", name="ck_accounts_password_is_argon2id"
        ),
        UniqueConstraint("email", name="uq_accounts_email"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    email: Mapped[str] = mapped_column(Text)
    display_name: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text)
    password_hash: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AuthSession(Base):
    """A server-side sign-in. The cookie holds a random token; only its SHA-256
    digest is stored, so a database copy cannot be replayed as a cookie."""

    __tablename__ = "auth_sessions"
    __table_args__ = (
        CheckConstraint("token_hash ~ '^[0-9a-f]{64}$'", name="ck_auth_sessions_token_hash"),
        CheckConstraint("length(csrf_token) >= 32", name="ck_auth_sessions_csrf_token"),
        CheckConstraint(
            "idle_expires_at <= expires_at",
            name="ck_auth_sessions_expiry_order",
        ),
        UniqueConstraint("token_hash", name="uq_auth_sessions_token_hash"),
        Index("ix_auth_sessions_account_id", "account_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    account_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("accounts.id", ondelete="CASCADE", name="fk_auth_sessions_account")
    )
    token_hash: Mapped[str] = mapped_column(Text)
    csrf_token: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    idle_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class HealthProfile(Base):
    """One private profile per account. The account ID is the key, so a profile
    can only ever be reached through its owner's session."""

    __tablename__ = "health_profiles"
    __table_args__ = (
        CheckConstraint("version >= 1", name="ck_health_profiles_version"),
        CheckConstraint(
            _in_list("medicines_state", SECTION_STATES), name="ck_health_profiles_medicines_state"
        ),
        CheckConstraint(
            _in_list("allergies_state", SECTION_STATES), name="ck_health_profiles_allergies_state"
        ),
        CheckConstraint(
            _in_list("conditions_state", SECTION_STATES),
            name="ck_health_profiles_conditions_state",
        ),
    )

    account_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("accounts.id", ondelete="CASCADE", name="fk_health_profiles_account"),
        primary_key=True,
    )
    version: Mapped[int] = mapped_column(Integer)
    medicines_state: Mapped[str] = mapped_column(Text)
    allergies_state: Mapped[str] = mapped_column(Text)
    conditions_state: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class HealthProfileEntry(Base):
    __tablename__ = "health_profile_entries"
    __table_args__ = (
        CheckConstraint(_in_list("section", PROFILE_SECTIONS), name="ck_profile_entries_section"),
        CheckConstraint(
            f"position >= 0 AND position < {ENTRIES_PER_SECTION_MAX}",
            name="ck_profile_entries_position",
        ),
        CheckConstraint(
            f"btrim(name) <> '' AND length(name) <= {ENTRY_NAME_MAX}",
            name="ck_profile_entries_name",
        ),
        CheckConstraint(
            f"note IS NULL OR (btrim(note) <> '' AND length(note) <= {ENTRY_NOTE_MAX})",
            name="ck_profile_entries_note",
        ),
        UniqueConstraint(
            "account_id", "section", "position", name="uq_profile_entries_position"
        ),
        Index(
            "uq_profile_entries_name",
            "account_id",
            "section",
            text("lower(name)"),
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    account_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "health_profiles.account_id", ondelete="CASCADE", name="fk_profile_entries_profile"
        ),
    )
    section: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(SmallInteger)
    name: Mapped[str] = mapped_column(Text)
    note: Mapped[Optional[str]] = mapped_column(Text)
