"""Add sign-in accounts, server-side sessions and private health profiles.

Revision ID: 0002
Revises: 0001

The consultation directory tables from 0001 are not touched, so this upgrade
runs the same way on an empty database and on one already holding the seeded
directory. Downgrading drops only the tables created here.
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

SECTION_STATES = "('not_recorded', 'none', 'recorded')"


def _timestamp(name: str, *, default: bool = False, nullable: bool = False) -> sa.Column:
    return sa.Column(
        name,
        sa.DateTime(timezone=True),
        nullable=nullable,
        server_default=sa.func.now() if default else None,
    )


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        _timestamp("created_at", default=True),
        sa.PrimaryKeyConstraint("id", name="pk_accounts"),
        sa.UniqueConstraint("email", name="uq_accounts_email"),
        sa.CheckConstraint(
            "email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254"
            " AND position('@' in email) > 1",
            name="ck_accounts_email_normalized",
        ),
        sa.CheckConstraint(
            "btrim(display_name) <> '' AND length(display_name) <= 80",
            name="ck_accounts_display_name",
        ),
        sa.CheckConstraint("role IN ('patient')", name="ck_accounts_role"),
        sa.CheckConstraint(
            "password_hash LIKE '$argon2id$%'", name="ck_accounts_password_is_argon2id"
        ),
    )
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("account_id", sa.BigInteger(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("csrf_token", sa.Text(), nullable=False),
        _timestamp("created_at", default=True),
        _timestamp("last_seen_at", default=True),
        _timestamp("idle_expires_at"),
        _timestamp("expires_at"),
        _timestamp("revoked_at", nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_auth_sessions"),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name="fk_auth_sessions_account",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("token_hash", name="uq_auth_sessions_token_hash"),
        sa.CheckConstraint(
            "token_hash ~ '^[0-9a-f]{64}$'", name="ck_auth_sessions_token_hash"
        ),
        sa.CheckConstraint("length(csrf_token) >= 32", name="ck_auth_sessions_csrf_token"),
        sa.CheckConstraint(
            "idle_expires_at <= expires_at",
            name="ck_auth_sessions_expiry_order",
        ),
    )
    op.create_index("ix_auth_sessions_account_id", "auth_sessions", ["account_id"])
    op.create_table(
        "health_profiles",
        sa.Column("account_id", sa.BigInteger(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("medicines_state", sa.Text(), nullable=False),
        sa.Column("allergies_state", sa.Text(), nullable=False),
        sa.Column("conditions_state", sa.Text(), nullable=False),
        _timestamp("updated_at", default=True),
        sa.PrimaryKeyConstraint("account_id", name="pk_health_profiles"),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name="fk_health_profiles_account",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("version >= 1", name="ck_health_profiles_version"),
        sa.CheckConstraint(
            f"medicines_state IN {SECTION_STATES}", name="ck_health_profiles_medicines_state"
        ),
        sa.CheckConstraint(
            f"allergies_state IN {SECTION_STATES}", name="ck_health_profiles_allergies_state"
        ),
        sa.CheckConstraint(
            f"conditions_state IN {SECTION_STATES}",
            name="ck_health_profiles_conditions_state",
        ),
    )
    op.create_table(
        "health_profile_entries",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("account_id", sa.BigInteger(), nullable=False),
        sa.Column("section", sa.Text(), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_health_profile_entries"),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["health_profiles.account_id"],
            name="fk_profile_entries_profile",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "account_id", "section", "position", name="uq_profile_entries_position"
        ),
        sa.CheckConstraint(
            "section IN ('medicines', 'allergies', 'conditions')",
            name="ck_profile_entries_section",
        ),
        sa.CheckConstraint(
            "position >= 0 AND position < 30", name="ck_profile_entries_position"
        ),
        sa.CheckConstraint(
            "btrim(name) <> '' AND length(name) <= 120", name="ck_profile_entries_name"
        ),
        sa.CheckConstraint(
            "note IS NULL OR (btrim(note) <> '' AND length(note) <= 300)",
            name="ck_profile_entries_note",
        ),
    )
    # The same name cannot appear twice in one section, ignoring case.
    op.create_index(
        "uq_profile_entries_name",
        "health_profile_entries",
        ["account_id", "section", sa.text("lower(name)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("health_profile_entries")
    op.drop_table("health_profiles")
    op.drop_table("auth_sessions")
    op.drop_table("accounts")
