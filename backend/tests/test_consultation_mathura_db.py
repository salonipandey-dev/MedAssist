"""The reviewed Mathura listings against a real PostgreSQL database.

Set MEDASSIST_TEST_DATABASE_URL to a database whose name ends in "_test"; these
tests drop and recreate tables in it. Without it they are skipped.

"Today" is pinned to 2026-11-17, the day the listings were checked, so the
freshness results do not change as the calendar moves on.
"""

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
from app.db import create_database_engine
from app.import_consultations import ImportRejected, import_dataset, load_dataset
from app.main import create_app
from app.seed import seed

BACKEND = Path(__file__).resolve().parents[1]
DATASETS = sorted((BACKEND / "app" / "datasets" / "mathura").glob("*.json"))
CLASH = BACKEND / "tests" / "fixtures" / "consultation_mathura_id_clash.json"
CAPTURED = BACKEND.parent / "frontend" / "tests" / "e2e" / "fixtures" / "consultations-mathura.json"
PATH = "/api/v1/consultations"
AS_OF = "2026-11-17"
TODAY = date(2026, 11, 17)
ESANJEEVANI = [
    "mathura-esj-up-general-opd",
    "mathura-esj-up-gmc-dermatology",
    "mathura-esj-up-gmc-obstetrics-gynaecology",
    "mathura-esj-up-gmc-paediatrics",
    "mathura-esj-up-gmc-psychiatry",
]
ALL_IDS = sorted(ESANJEEVANI + ["mathura-esic-dispensary-sadar", "mathura-tele-manas-helpline"])

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


def snapshot():
    listings = sql("SELECT * FROM consultation_listings ORDER BY id").all()
    sources = sql("SELECT * FROM consultation_sources ORDER BY id").all()
    return listings, sources


def reviewed_ids():
    return (
        sql(
            "SELECT id FROM consultation_listings WHERE source_kind = 'reviewed_external'"
            " ORDER BY id"
        )
        .scalars()
        .all()
    )


class MathuraTestCase(unittest.TestCase):
    def setUp(self):
        sql("DELETE FROM consultation_listings WHERE source_kind <> 'fictional_seed'")
        sql("DELETE FROM consultation_sources WHERE kind <> 'fictional_seed'")

    def import_all(self):
        summaries = []
        for path in DATASETS:
            dataset, sha = load_dataset(path, TODAY)
            summaries.append(import_dataset(engine, dataset, sha))
        return summaries


class ImportTests(MathuraTestCase):
    def test_importing_every_file_twice_keeps_rows_ids_and_counts(self):
        first = self.import_all()
        after_first = snapshot()[0]
        second = self.import_all()

        self.assertEqual(sum(s.inserted for s in first), 7)
        self.assertEqual([(s.inserted, s.removed) for s in second], [(0, 0)] * 3)
        self.assertEqual(sum(s.updated for s in second), 7)
        self.assertEqual(snapshot()[0], after_first)
        self.assertEqual(reviewed_ids(), ALL_IDS)
        counts = dict(
            sql(
                "SELECT id, listing_count FROM consultation_sources"
                " WHERE kind = 'reviewed_external'"
            ).all()
        )
        self.assertEqual(
            counts, {"mathura-esanjeevani-up": 5, "mathura-esic": 1, "mathura-tele-manas": 1}
        )

    def test_a_failed_update_keeps_the_previous_listings(self):
        self.import_all()
        before = snapshot()

        # The clash file changes a real row and the source version before it
        # reaches the demo ID c-01; the whole transaction must roll back.
        with self.assertRaisesRegex(ImportRejected, "c-01"):
            dataset, sha = load_dataset(CLASH, TODAY)
            import_dataset(engine, dataset, sha)

        self.assertEqual(snapshot(), before)
        self.assertEqual(
            sql(
                "SELECT version FROM consultation_sources WHERE id = 'mathura-esanjeevani-up'"
            ).scalar_one(),
            "2026-11-17",
        )
        self.assertNotIn(
            "TEST FILE",
            sql(
                "SELECT hours FROM consultation_listings WHERE id = 'mathura-esj-up-general-opd'"
            ).scalar_one(),
        )


class ApiTests(MathuraTestCase):
    def setUp(self):
        super().setUp()
        self.import_all()

    def client(self, as_of=AS_OF):
        url = engine.url.render_as_string(hide_password=False)
        environment = {
            "MEDASSIST_DATABASE_URL": url,
            "MEDASSIST_CORS_ORIGINS": "",
            "MEDASSIST_CONSULTATION_PILOT": "on",
            "MEDASSIST_PILOT_AS_OF": as_of,
            "MEDASSIST_PILOT_FRESHNESS_DAYS": "",
        }
        with patch.dict("os.environ", environment):
            application = create_app()
        client = TestClient(application)
        client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)
        return client

    def ids(self, client, **params):
        response = client.get(PATH, params={"limit": 50, **params})
        self.assertEqual(response.status_code, 200, response.text)
        return [item["id"] for item in response.json()["items"]]

    def test_the_pilot_serves_the_reviewed_listings_with_their_sources(self):
        response = self.client().get(PATH, params={"limit": 50})
        body = response.json()
        self.assertEqual([item["id"] for item in body["items"]], ALL_IDS)
        self.assertFalse(any(item["is_fictional"] for item in body["items"]))
        self.assertEqual(
            [source["id"] for source in body["dataset"]["sources"]],
            ["mathura-esanjeevani-up", "mathura-esic", "mathura-tele-manas"],
        )
        esic = next(i for i in body["items"] if i["id"] == "mathura-esic-dispensary-sadar")
        self.assertEqual(esic["fee"]["state"], "free")
        self.assertIn("insured", esic["access_conditions"])
        self.assertEqual(esic["source"]["listing_url"], "https://esic.gov.in/dispensaries")
        self.assertEqual(
            esic["source"]["reuse_basis_url"], "https://esic.gov.in/copyright-policy"
        )
        self.assertEqual(
            esic["verification"],
            {
                "status": "current",
                "checked_on": AS_OF,
                "recheck_due_on": "2027-02-15",
                "free_label_suppressed": False,
            },
        )
        tele = next(i for i in body["items"] if i["id"] == "mathura-tele-manas-helpline")
        self.assertEqual(
            tele["fee"], {"state": "unknown", "amount_minor": None, "currency": None, "basis": None}
        )

    def test_search_and_combined_filters(self):
        client = self.client()
        self.assertEqual(self.ids(client, q="dermatology"), ["mathura-esj-up-gmc-dermatology"])
        self.assertEqual(
            self.ids(client, q="esanjeevani", mode="video", fee_state="free"), ESANJEEVANI
        )
        self.assertEqual(self.ids(client, mode="phone"), ["mathura-tele-manas-helpline"])
        self.assertEqual(self.ids(client, fee_state="unknown"), ["mathura-tele-manas-helpline"])
        self.assertEqual(
            self.ids(client, mode="in_person", max_fee_minor=30000),
            ["mathura-esic-dispensary-sadar"],
        )
        self.assertEqual(self.ids(client, mode="in_person", fee_state="unknown"), [])

    def test_the_output_matches_the_frontend_capture(self):
        """consultations-mathura.json is what the API returns for these listings with
        the pilot on; only the import times differ from run to run."""
        with open(CAPTURED, encoding="utf-8") as handle:
            captured = json.load(handle)

        served = self.client().get(PATH).json()
        imported = [source.pop("imported_at") for source in served["dataset"]["sources"]]
        for source in captured["dataset"]["sources"]:
            source.pop("imported_at")

        self.assertTrue(all(imported))
        self.assertEqual(served, captured)

    def test_free_labels_are_hidden_once_the_checks_are_older_than_90_days(self):
        client = self.client(as_of="2027-02-16")
        self.assertEqual(self.ids(client, fee_state="free"), [])
        self.assertEqual(self.ids(client, fee_state="unknown"), ALL_IDS)
        body = client.get(PATH, params={"limit": 50}).json()
        self.assertTrue(
            all(item["verification"]["status"] == "needs_recheck" for item in body["items"])
        )


if __name__ == "__main__":
    unittest.main()
