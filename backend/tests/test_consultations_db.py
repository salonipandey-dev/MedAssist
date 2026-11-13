"""Consultation directory checks against a real PostgreSQL test database.

Set MEDASSIST_TEST_DATABASE_URL to a database whose name ends in "_test".
These tests drop and recreate the directory tables in it, so they refuse any
other name. Without the variable they are skipped and the rest of the suite
still runs.
"""

import os
import unittest
from pathlib import Path
from unittest.mock import patch

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.config import TEST_DATABASE_URL_ENV, get_database_url
from app.db import create_database_engine
from app.main import create_app
from app.seed import seed

PATH = "/api/v1/consultations"
ALL_IDS = [f"c-0{number}" for number in range(1, 10)]
FREE_BASIS = (
    "Shown as free for demonstration only. "
    "A real free service would need a verified source."
)
FICTIONAL_SOURCE = {
    "kind": "fictional_seed",
    "id": "medassist-fictional-seed",
    "name": "MedAssist fictional demonstration directory",
    "version": "1.0.0",
    "url": None,
    "last_checked_on": None,
}
LISTING_COLUMNS = (
    "id, provider_name, provider_type, specialty, area, modes, fee_state,"
    " fee_amount_minor, fee_currency, fee_basis, languages, source_id,"
    " source_kind, last_checked_on"
)
VALID_ROW = {
    "id": "t-01",
    "provider_name": "Test Clinic (fictional)",
    "provider_type": "clinic",
    "specialty": "General practice",
    "area": "Sample City",
    "modes": ["in_person"],
    "fee_state": "known",
    "fee_amount_minor": 10000,
    "fee_currency": "INR",
    "fee_basis": "Test basis",
    "languages": ["English"],
    "source_id": "medassist-fictional-seed",
    "source_kind": "fictional_seed",
    "last_checked_on": None,
}

engine = None
first_seed_rows = None
second_seed_rows = None


def _snapshot():
    with engine.connect() as connection:
        listings = connection.execute(
            text("SELECT * FROM consultation_listings ORDER BY id")
        ).all()
        sources = connection.execute(
            text("SELECT * FROM consultation_sources ORDER BY id")
        ).all()
    return listings, sources


def setUpModule():
    global engine, first_seed_rows, second_seed_rows
    if not os.getenv(TEST_DATABASE_URL_ENV, "").strip():
        raise unittest.SkipTest(f"{TEST_DATABASE_URL_ENV} is not set")

    url = get_database_url(TEST_DATABASE_URL_ENV)
    if not url.database.endswith("_test"):
        raise RuntimeError(
            f"{TEST_DATABASE_URL_ENV} must name a database ending in '_test'; "
            "these tests drop and recreate tables."
        )

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["database_url"] = url
    command.downgrade(config, "base")
    command.upgrade(config, "head")

    engine = create_database_engine(url)
    seed(engine)
    first_seed_rows = _snapshot()
    seed(engine)
    second_seed_rows = _snapshot()


def tearDownModule():
    if engine is not None:
        engine.dispose()


class DatabaseTestCase(unittest.TestCase):
    def make_client(self):
        url = engine.url.render_as_string(hide_password=False)
        with patch.dict(
            "os.environ", {"MEDASSIST_DATABASE_URL": url, "MEDASSIST_CORS_ORIGINS": ""}
        ):
            application = create_app()
        client = TestClient(application)
        client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)
        return client

    def setUp(self):
        self.client = self.make_client()

    def ids(self, **params):
        response = self.client.get(PATH, params=params)
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        ids = [item["id"] for item in body["items"]]
        if "limit" not in params and "offset" not in params:
            self.assertEqual(body["total"], len(ids))
        return ids


class MigrationAndSeedTests(DatabaseTestCase):
    def test_migration_is_at_head(self):
        with engine.connect() as connection:
            version = connection.scalar(text("SELECT version_num FROM alembic_version"))

        self.assertEqual(version, "0003")

    def test_repeated_seed_keeps_ids_rows_and_count(self):
        listings, sources = first_seed_rows

        self.assertEqual([row.id for row in listings], ALL_IDS)
        self.assertEqual(len(sources), 1)
        self.assertEqual(second_seed_rows, first_seed_rows)

    def test_seed_restores_an_edited_record_without_adding_rows(self):
        with engine.begin() as connection:
            connection.execute(
                text("UPDATE consultation_listings SET area = 'Edited' WHERE id = 'c-04'")
            )
        seed(engine)

        self.assertEqual(_snapshot(), first_seed_rows)


class DirectoryQueryTests(DatabaseTestCase):
    def test_unfiltered_list_is_ordered_and_bounded(self):
        body = self.client.get(PATH).json()

        self.assertEqual([item["id"] for item in body["items"]], ALL_IDS)
        self.assertEqual(
            {key: body[key] for key in ("total", "limit", "offset")},
            {"total": 9, "limit": 20, "offset": 0},
        )

    def test_pages_are_stable_and_report_the_full_total(self):
        pages = []
        for offset in (0, 4, 8, 12):
            body = self.client.get(PATH, params={"limit": 4, "offset": offset}).json()
            self.assertEqual(body["total"], 9)
            pages.append([item["id"] for item in body["items"]])

        self.assertEqual(pages, [ALL_IDS[0:4], ALL_IDS[4:8], ALL_IDS[8:9], []])
        self.assertEqual(self.ids(limit=4, offset=4), pages[1])

    def test_search_matches_name_specialty_and_area_ignoring_case(self):
        for query, expected in (
            ("riverside", ["c-01", "c-06"]),
            ("RIVERSIDE", ["c-01", "c-06"]),
            ("teleconsult", ["c-02"]),
            ("dermatology", ["c-05", "c-09"]),
            ("harbour ent", ["c-07"]),
            ("ent", ["c-04", "c-07", "c-08"]),  # Outpatients, ENT, Centre
            ("old market", ["c-03"]),
            ("   ", ALL_IDS),
            ("", ALL_IDS),
        ):
            with self.subTest(query=query):
                self.assertEqual(self.ids(q=query), expected)

    def test_every_search_term_must_match_across_fields(self):
        for query, expected in (
            ("riverside paediatrics", ["c-06"]),
            ("sample general", ["c-01", "c-03"]),
            ("  Remote   DERMATOLOGY ", ["c-09"]),
            ("clinic riverside family", ["c-01"]),
            ("riverside dermatology", []),
        ):
            with self.subTest(query=query):
                self.assertEqual(self.ids(q=query), expected)

    def test_search_treats_wildcards_as_plain_text(self):
        for query in ("%", "_", "\\", "river%", "c_inic"):
            with self.subTest(query=query):
                self.assertEqual(self.ids(q=query), [])

    def test_specialty_filter_is_exact_ignoring_case(self):
        self.assertEqual(self.ids(specialty="Dermatology"), ["c-05", "c-09"])
        self.assertEqual(self.ids(specialty="internal MEDICINE"), ["c-04", "c-08"])
        self.assertEqual(self.ids(specialty="Derma"), [])

    def test_mode_filter(self):
        self.assertEqual(self.ids(mode="video"), ["c-02", "c-05", "c-09"])
        self.assertEqual(self.ids(mode="phone"), ["c-02"])
        self.assertEqual(
            self.ids(mode="in_person"),
            ["c-01", "c-03", "c-04", "c-05", "c-06", "c-07", "c-08"],
        )

    def test_free_and_unknown_fees_are_separate_states(self):
        free = self.ids(fee_state="free")
        unknown = self.ids(fee_state="unknown")
        known = self.ids(fee_state="known")

        self.assertEqual(free, ["c-03", "c-08"])
        self.assertEqual(unknown, ["c-06", "c-09"])
        self.assertEqual(known, ["c-01", "c-02", "c-04", "c-05", "c-07"])
        self.assertEqual(sorted(free + unknown + known), ALL_IDS)

    def test_maximum_fee_is_inclusive_and_excludes_unknown(self):
        for maximum, expected in (
            (30000, ["c-01", "c-02", "c-03", "c-08"]),
            (29999, ["c-02", "c-03", "c-08"]),
            (30001, ["c-01", "c-02", "c-03", "c-08"]),
            (19900, ["c-02", "c-03", "c-08"]),
            (19899, ["c-03", "c-08"]),
            (0, ["c-03", "c-08"]),
            (100000000, ["c-01", "c-02", "c-03", "c-04", "c-05", "c-07", "c-08"]),
        ):
            with self.subTest(maximum=maximum):
                self.assertEqual(self.ids(max_fee_minor=maximum), expected)

    def test_filters_combine_with_and(self):
        for params, expected in (
            ({"max_fee_minor": 30000, "fee_state": "known"}, ["c-01", "c-02"]),
            ({"max_fee_minor": 30000, "fee_state": "free"}, ["c-03", "c-08"]),
            ({"max_fee_minor": 30000, "fee_state": "unknown"}, []),
            (
                {"specialty": "General practice", "mode": "in_person", "max_fee_minor": 30000},
                ["c-01", "c-03"],
            ),
            ({"q": "sample city", "mode": "video"}, ["c-05"]),
            ({"q": "remote", "specialty": "dermatology", "fee_state": "unknown"}, ["c-09"]),
            ({"q": "clinic", "specialty": "Dermatology", "mode": "video",
              "fee_state": "known", "max_fee_minor": 60000}, ["c-05"]),
            ({"q": "clinic", "specialty": "Dermatology", "mode": "video",
              "fee_state": "known", "max_fee_minor": 59999}, []),
        ):
            with self.subTest(params=params):
                self.assertEqual(self.ids(**params), expected)

    def test_valid_search_without_matches_returns_an_empty_page(self):
        response = self.client.get(PATH, params={"q": "no-such-provider"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(), {"items": [], "total": 0, "limit": 20, "offset": 0}
        )

    def test_repeated_requests_return_identical_bodies(self):
        params = {"q": "sample", "max_fee_minor": 50000}

        first = self.client.get(PATH, params=params)
        second = self.client.get(PATH, params=params)

        self.assertEqual(first.content, second.content)
        self.assertNotEqual(first.headers["X-Request-ID"], second.headers["X-Request-ID"])


class DirectoryPayloadTests(DatabaseTestCase):
    def item(self, listing_id):
        items = self.client.get(PATH).json()["items"]
        return next(item for item in items if item["id"] == listing_id)

    def test_known_fee_listing(self):
        self.assertEqual(
            self.item("c-01"),
            {
                "id": "c-01",
                "provider_name": "Riverside Family Clinic (fictional)",
                "provider_type": "clinic",
                "specialty": "General practice",
                "modes": ["in_person"],
                "area": "Riverside, Sample City",
                "fee": {
                    "state": "known",
                    "amount_minor": 30000,
                    "currency": "INR",
                    "basis": "Illustrative fee for a first consultation.",
                },
                "access_conditions": None,
                "languages": ["English", "Hindi"],
                "hours": "Weekdays · morning and evening (illustrative)",
                "notes": "Illustrative fee for a first consultation.",
                "is_fictional": True,
                "source": FICTIONAL_SOURCE,
            },
        )

    def test_free_listing_states_its_fictional_basis(self):
        item = self.item("c-03")

        self.assertEqual(
            item["fee"],
            {"state": "free", "amount_minor": 0, "currency": "INR", "basis": FREE_BASIS},
        )
        self.assertEqual(
            item["access_conditions"], "Fictional example: walk-in on camp days only."
        )

    def test_unknown_fee_has_no_amount_currency_or_basis(self):
        item = self.item("c-06")

        self.assertEqual(
            item["fee"],
            {"state": "unknown", "amount_minor": None, "currency": None, "basis": None},
        )
        self.assertIsNone(item["hours"])
        self.assertEqual(item["provider_name"], "Little Steps Children’s Clinic (fictional)")

    def test_every_seeded_record_is_marked_fictional_and_unverified(self):
        for item in self.client.get(PATH).json()["items"]:
            with self.subTest(listing=item["id"]):
                self.assertIs(item["is_fictional"], True)
                self.assertEqual(item["source"], FICTIONAL_SOURCE)

    def test_modes_and_languages_keep_their_order(self):
        self.assertEqual(self.item("c-02")["modes"], ["video", "phone"])
        self.assertEqual(self.item("c-08")["languages"], ["Hindi", "English"])


class ReadsFromPostgresTests(DatabaseTestCase):
    def test_database_changes_appear_in_this_and_a_new_app_instance(self):
        self.addCleanup(seed, engine)
        with engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE consultation_listings SET area = 'Lighthouse Quay,"
                    " Sample City' WHERE id = 'c-07'"
                )
            )

        self.assertEqual(self.ids(q="lighthouse"), ["c-07"])
        restarted = self.make_client().get(PATH, params={"q": "lighthouse"}).json()
        self.assertEqual([item["id"] for item in restarted["items"]], ["c-07"])

        seed(engine)
        self.assertEqual(self.ids(q="lighthouse"), [])
        self.assertEqual(self.ids(q="harbour road"), ["c-07"])


class ConstraintTests(DatabaseTestCase):
    def insert(self, **changes):
        row = {**VALID_ROW, **changes}
        placeholders = ", ".join(f":{name}" for name in row)
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                connection.execute(
                    text(
                        f"INSERT INTO consultation_listings ({LISTING_COLUMNS})"
                        f" VALUES ({placeholders})"
                    ),
                    row,
                )
            finally:
                transaction.rollback()

    def test_a_valid_row_is_accepted(self):
        self.insert()
        self.insert(fee_state="free", fee_amount_minor=0)
        self.insert(
            fee_state="unknown", fee_amount_minor=None, fee_currency=None, fee_basis=None
        )

    def test_invalid_rows_are_rejected(self):
        unknown = {"fee_state": "unknown", "fee_amount_minor": None,
                   "fee_currency": None, "fee_basis": None}
        cases = {
            "known without amount": {"fee_amount_minor": None},
            "known with zero amount": {"fee_amount_minor": 0},
            "known with negative amount": {"fee_amount_minor": -100},
            "known without basis": {"fee_basis": None},
            "known without currency": {"fee_currency": None},
            "known in another currency": {"fee_currency": "USD"},
            "free without basis": {"fee_state": "free", "fee_amount_minor": 0,
                                   "fee_basis": None},
            "free with blank basis": {"fee_state": "free", "fee_amount_minor": 0,
                                      "fee_basis": "   "},
            "free with an amount": {"fee_state": "free"},
            "free without amount": {"fee_state": "free", "fee_amount_minor": None},
            "unknown with amount": {**unknown, "fee_amount_minor": 0},
            "unknown with currency": {**unknown, "fee_currency": "INR"},
            "unknown with basis": {**unknown, "fee_basis": "Guess"},
            "unlisted fee state": {"fee_state": "cheap"},
            "unlisted mode": {"modes": ["in_person", "fax"]},
            "no modes": {"modes": []},
            "unlisted provider type": {"provider_type": "pharmacy"},
            "blank provider name": {"provider_name": "  "},
            "malformed id": {"id": "Has Spaces"},
            "duplicate id": {"id": "c-01"},
            "unknown source": {"source_id": "missing"},
            "source kind mismatch": {"source_kind": "reviewed_external"},
            "fictional with a check date": {"last_checked_on": "2026-01-01"},
        }
        for name, changes in cases.items():
            with self.subTest(case=name):
                with self.assertRaises(IntegrityError):
                    self.insert(**changes)

    def test_fictional_source_cannot_carry_a_url(self):
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                with self.assertRaises(IntegrityError):
                    connection.execute(
                        text(
                            "UPDATE consultation_sources SET url ="
                            " 'https://example.invalid' WHERE kind = 'fictional_seed'"
                        )
                    )
            finally:
                transaction.rollback()


if __name__ == "__main__":
    unittest.main()
