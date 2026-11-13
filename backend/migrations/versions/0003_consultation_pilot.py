"""Record verified sources for the consultation pilot.

Revision ID: 0003
Revises: 0002

- Sources gain a `pilot_fixture` kind for clearly fictional test records with
  the shape of real pilot data, plus who published the data, the locality,
  the basis for reusing it, and the last successful import.
- Listings gain the URL of the page each one was checked against. Every
  pilot listing (reviewed or fixture) must have that URL and a check date;
  fictional seed listings must have neither.
- Fixture URLs must be on example.org/.com/.net and reviewed URLs must not,
  so test data can never pass for a real source.

Downgrading deletes pilot fixture listings and sources, because the 0002
schema has no place for them. Reviewed listings stay.
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

EXAMPLE_URL = r"'^https://([a-z0-9-]+\.)*example\.(org|com|net)(/|$)'"
PILOT_KINDS = "('reviewed_external', 'pilot_fixture')"


def upgrade() -> None:
    op.drop_constraint("ck_consultation_sources_kind", "consultation_sources", type_="check")
    op.create_check_constraint(
        "ck_consultation_sources_kind",
        "consultation_sources",
        "kind IN ('fictional_seed', 'reviewed_external', 'pilot_fixture')",
    )
    for column in ("publisher", "locality", "reuse_basis", "reuse_basis_url", "dataset_sha256"):
        op.add_column("consultation_sources", sa.Column(column, sa.Text(), nullable=True))
    op.add_column(
        "consultation_sources",
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "consultation_sources", sa.Column("listing_count", sa.Integer(), nullable=True)
    )
    op.create_check_constraint(
        "ck_consultation_sources_pilot_provenance",
        "consultation_sources",
        # IS NOT NULL matters: a CHECK whose expression is NULL passes.
        f"kind NOT IN {PILOT_KINDS} OR (url IS NOT NULL AND url ~ '^https://'"
        " AND publisher IS NOT NULL AND btrim(publisher) <> ''"
        " AND locality IS NOT NULL AND btrim(locality) <> ''"
        " AND reuse_basis IS NOT NULL AND btrim(reuse_basis) <> '')",
    )
    op.create_check_constraint(
        "ck_consultation_sources_fixture_urls",
        "consultation_sources",
        f"(kind = 'pilot_fixture') = (url IS NOT NULL AND url ~ {EXAMPLE_URL})"
        " OR kind = 'fictional_seed'",
    )

    op.add_column(
        "consultation_listings", sa.Column("source_url", sa.Text(), nullable=True)
    )
    op.create_check_constraint(
        "ck_consultation_listings_pilot_verified",
        "consultation_listings",
        "(source_kind = 'fictional_seed' AND source_url IS NULL)"
        " OR (source_kind <> 'fictional_seed' AND source_url IS NOT NULL"
        " AND source_url ~ '^https://' AND last_checked_on IS NOT NULL)",
    )
    op.create_check_constraint(
        "ck_consultation_listings_fixture_urls",
        "consultation_listings",
        f"source_kind = 'fictional_seed'"
        f" OR (source_kind = 'pilot_fixture') = (source_url ~ {EXAMPLE_URL})",
    )
    op.create_index(
        "ix_consultation_listings_source", "consultation_listings", ["source_id", "source_kind"]
    )


def downgrade() -> None:
    op.execute("DELETE FROM consultation_listings WHERE source_kind = 'pilot_fixture'")
    op.execute("DELETE FROM consultation_sources WHERE kind = 'pilot_fixture'")
    op.drop_index("ix_consultation_listings_source", table_name="consultation_listings")
    op.drop_constraint(
        "ck_consultation_listings_fixture_urls", "consultation_listings", type_="check"
    )
    op.drop_constraint(
        "ck_consultation_listings_pilot_verified", "consultation_listings", type_="check"
    )
    op.drop_column("consultation_listings", "source_url")
    op.drop_constraint(
        "ck_consultation_sources_fixture_urls", "consultation_sources", type_="check"
    )
    op.drop_constraint(
        "ck_consultation_sources_pilot_provenance", "consultation_sources", type_="check"
    )
    for column in (
        "listing_count",
        "imported_at",
        "dataset_sha256",
        "reuse_basis_url",
        "reuse_basis",
        "locality",
        "publisher",
    ):
        op.drop_column("consultation_sources", column)
    op.drop_constraint("ck_consultation_sources_kind", "consultation_sources", type_="check")
    op.create_check_constraint(
        "ck_consultation_sources_kind",
        "consultation_sources",
        "kind IN ('fictional_seed', 'reviewed_external')",
    )
