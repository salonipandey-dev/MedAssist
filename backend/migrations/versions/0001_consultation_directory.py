"""Create the consultation directory tables.

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "consultation_sources",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("version", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_consultation_sources"),
        sa.UniqueConstraint("id", "kind", name="uq_consultation_sources_id_kind"),
        sa.CheckConstraint(
            "kind IN ('fictional_seed', 'reviewed_external')",
            name="ck_consultation_sources_kind",
        ),
        sa.CheckConstraint(
            "btrim(name) <> '' AND btrim(version) <> ''",
            name="ck_consultation_sources_not_blank",
        ),
        sa.CheckConstraint(
            "kind <> 'fictional_seed' OR url IS NULL",
            name="ck_consultation_sources_fictional_has_no_url",
        ),
    )
    op.create_table(
        "consultation_listings",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("provider_name", sa.Text(), nullable=False),
        sa.Column("provider_type", sa.Text(), nullable=False),
        sa.Column("specialty", sa.Text(), nullable=False),
        sa.Column("area", sa.Text(), nullable=False),
        sa.Column("modes", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("fee_state", sa.Text(), nullable=False),
        sa.Column("fee_amount_minor", sa.Integer(), nullable=True),
        sa.Column("fee_currency", sa.Text(), nullable=True),
        sa.Column("fee_basis", sa.Text(), nullable=True),
        sa.Column("access_conditions", sa.Text(), nullable=True),
        sa.Column(
            "languages",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column("hours", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source_id", sa.Text(), nullable=False),
        sa.Column("source_kind", sa.Text(), nullable=False),
        sa.Column("last_checked_on", sa.Date(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_consultation_listings"),
        sa.ForeignKeyConstraint(
            ["source_id", "source_kind"],
            ["consultation_sources.id", "consultation_sources.kind"],
            name="fk_consultation_listings_source",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "id ~ '^[a-z0-9][a-z0-9-]{0,63}$'",
            name="ck_consultation_listings_id_format",
        ),
        sa.CheckConstraint(
            "btrim(provider_name) <> '' AND btrim(specialty) <> '' AND btrim(area) <> ''",
            name="ck_consultation_listings_not_blank",
        ),
        sa.CheckConstraint(
            "provider_type IN ('clinic', 'hospital_outpatient', 'teleconsultation',"
            " 'community_camp')",
            name="ck_consultation_listings_provider_type",
        ),
        sa.CheckConstraint(
            "cardinality(modes) >= 1"
            " AND modes <@ ARRAY['in_person', 'video', 'phone']::text[]",
            name="ck_consultation_listings_modes",
        ),
        sa.CheckConstraint(
            "fee_state IN ('known', 'free', 'unknown')",
            name="ck_consultation_listings_fee_state",
        ),
        # Exactly one of: known positive amount, explicit free with a basis,
        # or unknown with no amount, currency or basis. The IS NOT NULL tests
        # matter: a CHECK passes when its expression is NULL.
        sa.CheckConstraint(
            "(fee_state = 'known' AND fee_amount_minor IS NOT NULL"
            " AND fee_amount_minor > 0 AND fee_currency IS NOT NULL AND fee_currency = 'INR'"
            " AND fee_basis IS NOT NULL AND btrim(fee_basis) <> '')"
            " OR (fee_state = 'free' AND fee_amount_minor IS NOT NULL"
            " AND fee_amount_minor = 0 AND fee_currency IS NOT NULL AND fee_currency = 'INR'"
            " AND fee_basis IS NOT NULL AND btrim(fee_basis) <> '')"
            " OR (fee_state = 'unknown' AND fee_amount_minor IS NULL"
            " AND fee_currency IS NULL AND fee_basis IS NULL)",
            name="ck_consultation_listings_fee_consistent",
        ),
        sa.CheckConstraint(
            "source_kind <> 'fictional_seed' OR last_checked_on IS NULL",
            name="ck_consultation_listings_fictional_not_verified",
        ),
    )


def downgrade() -> None:
    op.drop_table("consultation_listings")
    op.drop_table("consultation_sources")
