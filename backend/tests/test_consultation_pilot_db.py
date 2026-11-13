"""The consultation pilot against a real PostgreSQL database.

Set MEDASSIST_TEST_DATABASE_URL to a database whose name ends in "_test"; these
tests drop and recreate tables in it. Without it they are skipped.

All pilot data here comes from clearly labelled fictional fixtures. "Today" is
pinned to 2026-11-13 so the fixture's check dates keep the same freshness.
"""

import copy
import json
import os
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import TEST_DATABASE_URL_ENV, get_database_url
from app.consultation_pilot import PilotDataset
from app.db import create_database_engine
from app.import_consultations import ImportRejected, import_dataset, load_dataset, main
from app.main import create_app
from app.seed import seed

BACKEND = Path(__file__).resolve().parents[1]
FIXTURE = BACKEND / "app" / "fixtures" / "consultation_pilot_fixture.json"
CLASH = BACKEND / "tests" / "fixtures" / "consultation_pilot_id_clash.json"
INVALID = BACKEND / "tests" / "fixtures" / "consultation_pilot_invalid.json"
CAPTURED = BACKEND.parent / "frontend" / "tests" / "e2e" / "fixtures" / "consultations.json"
CAPTURED_PILOT = CAPTURED.with_name("consultations-pilot.json")
PATH = "/api/v1/consultations"
AS_OF = "2026-11-13"
TODAY = date(2026, 11, 13)
FIXTURE_IDS = [
    "fx-child-camp",
    "fx-civil-opd",
    "fx-ent-opd",
    "fx-skin-clinic",
    "fx-tele-unknown",
    "fx-wellness-free",
]
SEED_IDS = [f"c-0{number}" for number in range(1, 10)]

engine = None


def setUpModule():
    global engine
    if not os.getenv(TEST_DATABASE_URL_ENV, "").strip():
        raise unittest.SkipTest(f"{TEST_DATABASE_URL_ENV} is not set")
    url = get_database_url(TEST_DATABASE_URL_ENV)
    if not url.database.endswith("_test"):
        raise RuntimeError(f"{TEST_DATABASE_URL_ENV} must name a database ending in '_test'.")
    config = Config(str(BACKEND / "alembic.ini"))
    config.attributes["database_url"] = url
    engine = create_database_engine(url)
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    seed(engine)


def tearDownModule():
    if engine is not None:
        engine.dispose()


def sql(statement, **params):
    with engine.begin() as connection:
        return connection.execute(text(statement), params)


def listings_snapshot():
    return sql("SELECT * FROM consultation_listings ORDER BY id").all()


def sources_snapshot():
    return sql("SELECT * FROM consultation_sources ORDER BY id").all()


def fixture_data():
    with open(FIXTURE, encoding="utf-8") as handle:
        return json.load(handle)


def dataset_from(data):
    return PilotDataset.model_validate(data)


class PilotTestCase(unittest.TestCase):
    def setUp(self):
        sql("DELETE FROM consultation_listings WHERE source_kind <> 'fictional_seed'")
        sql("DELETE FROM consultation_sources WHERE kind <> 'fictional_seed'")

    def import_file(self, path=FIXTURE):
        dataset, sha = load_dataset(path, TODAY)
        return import_dataset(engine, dataset, sha)


class ImportTests(PilotTestCase):
    def test_importing_the_same_file_twice_keeps_rows_and_ids(self):
        first = self.import_file()
        rows_after_first = listings_snapshot()
        second = self.import_file()

        self.assertEqual((first.inserted, first.updated, first.removed), (6, 0, 0))
        self.assertEqual((second.inserted, second.updated, second.removed), (0, 6, 0))
        self.assertEqual(listings_snapshot(), rows_after_first)
        self.assertEqual(
            sql(
                "SELECT id FROM consultation_listings WHERE source_kind = 'pilot_fixture'"
                " ORDER BY id"
            ).scalars().all(),
            FIXTURE_IDS,
        )
        self.assertEqual(
            sql("SELECT count(*) FROM consultation_listings").scalar_one(), 6 + len(SEED_IDS)
        )
        source = sql(
            "SELECT listing_count, dataset_sha256, imported_at IS NOT NULL AS imported"
            " FROM consultation_sources WHERE kind = 'pilot_fixture'"
        ).one()
        self.assertEqual((source.listing_count, source.dataset_sha256, source.imported), (6, first.sha256, True))

    def test_imported_rows_keep_their_provenance(self):
        self.import_file()

        row = sql(
            "SELECT l.fee_state, l.fee_amount_minor, l.fee_basis, l.access_conditions,"
            " l.source_url, l.last_checked_on, s.reuse_basis, s.locality, s.publisher"
            " FROM consultation_listings l JOIN consultation_sources s ON s.id = l.source_id"
            " WHERE l.id = 'fx-wellness-free'"
        ).one()
        self.assertEqual(row.fee_state, "free")
        self.assertEqual(row.fee_amount_minor, 0)
        self.assertIn("free of charge", row.fee_basis)
        self.assertIn("Ward 4", row.access_conditions)
        self.assertEqual(row.source_url, "https://pilot-source.example.org/facilities/wellness-ward-4")
        self.assertEqual(row.last_checked_on, date(2026, 11, 2))
        self.assertIn("FICTIONAL TEST DATA", row.reuse_basis)
        self.assertEqual(row.locality, "Sample District (fictional)")

    def test_a_failed_import_keeps_the_previous_dataset_and_its_check_dates(self):
        self.import_file()
        listings_before, sources_before = listings_snapshot(), sources_snapshot()

        with self.assertRaisesRegex(ImportRejected, "c-01"):
            self.import_file(CLASH)

        # The clash file changed the source version and every check date and
        # had already written the source row; all of it was rolled back.
        self.assertEqual(listings_snapshot(), listings_before)
        self.assertEqual(sources_snapshot(), sources_before)
        self.assertEqual(
            sql("SELECT version FROM consultation_sources WHERE kind = 'pilot_fixture'").scalar_one(),
            "2026.11-fixture-1",
        )

    def test_a_failure_after_rows_are_written_rolls_everything_back(self):
        self.import_file()
        listings_before, sources_before = listings_snapshot(), sources_snapshot()
        changed = fixture_data()
        changed["listings"].pop()  # remove one listing
        for listing in changed["listings"]:
            listing["last_checked_on"] = "2026-11-12"

        with patch("app.import_consultations._record_import", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                import_dataset(engine, dataset_from(changed), "0" * 64)

        self.assertEqual(listings_snapshot(), listings_before)
        self.assertEqual(sources_snapshot(), sources_before)

    def test_listings_missing_from_a_new_file_are_removed_and_new_ones_added(self):
        self.import_file()
        changed = fixture_data()
        removed = changed["listings"].pop(0)
        added = copy.deepcopy(changed["listings"][0])
        added.update(
            id="fx-new-clinic",
            provider_name="Fixture New Clinic (fictional)",
            source_url="https://pilot-source.example.org/facilities/new-clinic",
        )
        changed["listings"].append(added)

        summary = import_dataset(engine, dataset_from(changed), "1" * 64)

        self.assertEqual((summary.inserted, summary.updated, summary.removed), (1, 5, 1))
        ids = sql(
            "SELECT id FROM consultation_listings WHERE source_kind = 'pilot_fixture'"
        ).scalars().all()
        self.assertNotIn(removed["id"], ids)
        self.assertIn("fx-new-clinic", ids)
        self.assertEqual(sql("SELECT count(*) FROM consultation_listings WHERE id LIKE 'c-%'").scalar_one(), 9)

    def test_a_source_cannot_change_kind(self):
        self.import_file()
        reviewed = fixture_data()
        reviewed["source"]["kind"] = "reviewed_external"
        for item in [reviewed["source"], *reviewed["listings"]]:
            for key in ("url", "source_url", "reuse_basis_url"):
                if item.get(key):
                    item[key] = item[key].replace("pilot-source.example.org", "pilot-source.test")
        before = listings_snapshot()

        with self.assertRaisesRegex(ImportRejected, "different kind"):
            import_dataset(engine, dataset_from(reviewed), "2" * 64)
        self.assertEqual(listings_snapshot(), before)

    def test_the_command_line_import(self):
        environment = {
            "MEDASSIST_DATABASE_URL": engine.url.render_as_string(hide_password=False),
            "MEDASSIST_PILOT_AS_OF": AS_OF,
        }
        with patch.dict("os.environ", environment):
            self.assertEqual(main([str(FIXTURE)]), 0)
            before = listings_snapshot()
            self.assertEqual(main([str(INVALID)]), 1)
            self.assertEqual(main([str(CLASH)]), 1)
            self.assertEqual(main([]), 2)
        self.assertEqual(listings_snapshot(), before)
        with patch.dict("os.environ", {**environment, "MEDASSIST_PILOT_AS_OF": "2026-10-01"}):
            # Check dates after "today" are refused.
            self.assertEqual(main([str(FIXTURE)]), 1)


class PilotApiTests(PilotTestCase):
    def setUp(self):
        super().setUp()
        self.import_file()

    def client(self, pilot="off", **extra):
        url = engine.url.render_as_string(hide_password=False)
        environment = {
            "MEDASSIST_DATABASE_URL": url,
            "MEDASSIST_CORS_ORIGINS": "",
            "MEDASSIST_CONSULTATION_PILOT": pilot,
            "MEDASSIST_PILOT_AS_OF": AS_OF,
            "MEDASSIST_PILOT_FRESHNESS_DAYS": "",
            **extra,
        }
        with patch.dict("os.environ", environment):
            application = create_app()
        client = TestClient(application)
        client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)
        return client

    def page(self, client, **params):
        response = client.get(PATH, params={"limit": 50, **params})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def by_id(self, client, **params):
        return {item["id"]: item for item in self.page(client, **params)["items"]}

    def test_the_disabled_pilot_serves_only_the_fictional_demo(self):
        for setting in ("", "off"):
            with self.subTest(setting=setting):
                client = self.client(pilot=setting)
                body = self.page(client)
                self.assertEqual([item["id"] for item in body["items"]], SEED_IDS)
                self.assertTrue(all(item["is_fictional"] for item in body["items"]))
                self.assertEqual(body["dataset"]["mode"], "demo")
                self.assertFalse(body["dataset"]["pilot_enabled"])
                self.assertEqual(
                    [source["kind"] for source in body["dataset"]["sources"]], ["fictional_seed"]
                )
                self.assertEqual(self.page(client, q="fixture")["total"], 0)
                refused = client.get(PATH, params={"dataset": "pilot"})
                self.assertEqual(refused.status_code, 404)

    def test_the_enabled_pilot_serves_imported_listings_and_keeps_the_demo(self):
        client = self.client(pilot="on")
        body = self.page(client)

        self.assertEqual([item["id"] for item in body["items"]], FIXTURE_IDS)
        dataset = body["dataset"]
        self.assertEqual((dataset["mode"], dataset["pilot_enabled"]), ("pilot", True))
        self.assertEqual((dataset["freshness_days"], dataset["as_of"]), (90, AS_OF))
        self.assertEqual(
            dataset["specialties"], ["Dermatology", "ENT", "General practice", "Paediatrics"]
        )
        [source] = dataset["sources"]
        self.assertEqual(source["kind"], "pilot_fixture")
        self.assertEqual(source["listing_count"], 6)
        self.assertIn("FICTIONAL TEST DATA", source["reuse_basis"])
        self.assertIsNotNone(source["imported_at"])
        demo = self.page(client, dataset="demo")
        self.assertEqual([item["id"] for item in demo["items"]], SEED_IDS)
        self.assertEqual(demo["dataset"]["mode"], "demo")

    def test_fee_eligibility_source_and_freshness_for_each_case(self):
        items = self.by_id(self.client(pilot="on"))
        known = items["fx-civil-opd"]
        self.assertEqual(known["fee"], {
            "state": "known",
            "amount_minor": 1000,
            "currency": "INR",
            "basis": "Fixture source lists an OPD registration fee of ₹10 per visit.",
        })
        self.assertEqual(known["verification"], {
            "status": "current",
            "checked_on": "2026-11-02",
            "recheck_due_on": "2027-01-31",
            "free_label_suppressed": False,
        })
        self.assertEqual(
            known["source"]["listing_url"], "https://pilot-source.example.org/facilities/civil-opd"
        )
        self.assertEqual(known["source"]["last_checked_on"], "2026-11-02")
        self.assertTrue(known["is_fictional"])

        free = items["fx-wellness-free"]
        self.assertEqual(free["fee"]["state"], "free")
        self.assertIn("free of charge", free["fee"]["basis"])
        self.assertIn("Ward 4", free["access_conditions"])
        self.assertEqual(free["verification"]["status"], "current")

        unknown = items["fx-tele-unknown"]
        self.assertEqual(unknown["fee"], {"state": "unknown", "amount_minor": None, "currency": None, "basis": None})

        stale_free = items["fx-child-camp"]
        self.assertEqual(stale_free["fee"]["state"], "unknown")
        self.assertEqual(
            stale_free["verification"],
            {
                "status": "needs_recheck",
                "checked_on": "2026-06-01",
                "recheck_due_on": "2026-08-30",
                "free_label_suppressed": True,
            },
        )
        self.assertEqual(stale_free["access_conditions"], "Children under 12 only (fixture condition).")

        stale_known = items["fx-ent-opd"]
        self.assertEqual((stale_known["fee"]["state"], stale_known["fee"]["amount_minor"]), ("known", 5000))
        self.assertEqual(stale_known["verification"]["status"], "needs_recheck")
        self.assertFalse(stale_known["verification"]["free_label_suppressed"])

    def test_filters_treat_a_stale_free_listing_as_unknown(self):
        client = self.client(pilot="on")
        ids = lambda **params: [item["id"] for item in self.page(client, **params)["items"]]  # noqa: E731

        self.assertEqual(ids(fee_state="free"), ["fx-wellness-free"])
        self.assertEqual(ids(fee_state="unknown"), ["fx-child-camp", "fx-tele-unknown"])
        self.assertEqual(ids(fee_state="known"), ["fx-civil-opd", "fx-ent-opd", "fx-skin-clinic"])
        self.assertEqual(
            ids(max_fee_minor=30000), ["fx-civil-opd", "fx-ent-opd", "fx-skin-clinic", "fx-wellness-free"]
        )
        self.assertEqual(ids(q="ward 4"), ["fx-wellness-free"])
        self.assertEqual(ids(specialty="dermatology", mode="video"), ["fx-skin-clinic"])

    def test_rechecking_a_listing_restores_its_free_label(self):
        rechecked = fixture_data()
        for listing in rechecked["listings"]:
            if listing["id"] == "fx-child-camp":
                listing["last_checked_on"] = "2026-11-10"
        import_dataset(engine, dataset_from(rechecked), "3" * 64)

        camp = self.by_id(self.client(pilot="on"))["fx-child-camp"]

        self.assertEqual(camp["fee"]["state"], "free")
        self.assertEqual(camp["verification"]["status"], "current")

    def test_the_freshness_window_is_a_server_setting(self):
        items = self.by_id(self.client(pilot="on", MEDASSIST_PILOT_FRESHNESS_DAYS="365"))

        self.assertEqual(items["fx-child-camp"]["verification"]["status"], "current")
        self.assertEqual(items["fx-child-camp"]["fee"]["state"], "free")

    def test_the_demo_output_matches_the_frontend_capture(self):
        """The browser tests replay frontend/tests/e2e/fixtures/consultations.json;
        it must stay exactly what the API returns for the demo."""
        with open(CAPTURED, encoding="utf-8") as handle:
            captured = json.load(handle)

        response = self.client(pilot="off").get(PATH)

        self.assertEqual(response.json(), captured)

    def test_the_pilot_output_matches_the_frontend_pilot_capture(self):
        """consultations-pilot.json is what the API returns for the imported fixture
        with the pilot on; only the import time differs from run to run."""
        with open(CAPTURED_PILOT, encoding="utf-8") as handle:
            captured = json.load(handle)

        served = self.client(pilot="on").get(PATH).json()
        imported_at = served["dataset"]["sources"][0].pop("imported_at")
        captured["dataset"]["sources"][0].pop("imported_at")

        self.assertIsNotNone(imported_at)
        self.assertEqual(served, captured)
