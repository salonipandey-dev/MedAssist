"""Consultation directory checks that run without PostgreSQL.

They cover query validation, the service-error contract, database settings,
OpenAPI, the fee schema and the seed records. Queries against real tables are
in test_consultations_db.py.
"""

import unittest
from unittest.mock import patch
from uuid import UUID

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import get_database_url
from app.consultations import UNAVAILABLE_MESSAGE
from app.main import create_app
from app.schemas import ConsultationFee
from app.seed import FICTIONAL_LISTINGS, FICTIONAL_SOURCE

PATH = "/api/v1/consultations"
# Nothing listens on port 9 locally, so connections are refused immediately.
UNREACHABLE_URL = "postgresql://medassist:not-a-real-secret@127.0.0.1:9/medassist"


class ConsultationContractTests(unittest.TestCase):
    def make_client(self, database_url="", origins=""):
        environment = {
            "MEDASSIST_DATABASE_URL": database_url,
            "MEDASSIST_CORS_ORIGINS": origins,
        }
        with patch.dict("os.environ", environment):
            application = create_app()
        client = TestClient(application)
        client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)
        return client

    def assert_service_error(self, response):
        self.assertEqual(response.status_code, 503)
        request_id = response.headers["X-Request-ID"]
        self.assertEqual(UUID(request_id).version, 4)
        self.assertEqual(
            response.json(), {"detail": UNAVAILABLE_MESSAGE, "request_id": request_id}
        )
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_invalid_filters_return_validation_errors(self):
        client = self.make_client()
        for query in (
            "mode=fax",
            "mode=In%20person",
            "fee_state=cheap",
            "max_fee_minor=-1",
            "max_fee_minor=abc",
            "max_fee_minor=300.5",
            "max_fee_minor=100000001",
            "limit=0",
            "limit=51",
            "offset=-1",
            "offset=10001",
            "specialty=",
            "specialty=" + "s" * 61,
            "q=" + "q" * 61,
        ):
            with self.subTest(query=query):
                response = client.get(f"{PATH}?{query}")

                self.assertEqual(response.status_code, 422)
                errors = response.json()["detail"]
                self.assertEqual(errors[0]["loc"][0], "query")
                self.assertEqual(errors[0]["loc"][1], query.split("=")[0])
                UUID(response.headers["X-Request-ID"])

    def test_directory_is_unavailable_until_a_database_is_configured(self):
        with self.assertLogs("medassist.consultations", level="ERROR"):
            response = self.make_client().get(PATH)

        self.assert_service_error(response)

    def test_unreachable_database_returns_a_traceable_generic_error(self):
        client = self.make_client(UNREACHABLE_URL)
        with self.assertLogs("medassist.consultations", level="ERROR") as logs:
            response = client.get(PATH, params={"q": "clinic"})

        self.assert_service_error(response)
        logged = "\n".join(logs.output)
        self.assertIn(response.headers["X-Request-ID"], logged)
        for private in ("not-a-real-secret", "127.0.0.1", "psycopg", "clinic"):
            with self.subTest(private=private):
                self.assertNotIn(private, response.text)
                self.assertNotIn(private, logged)

    def test_each_failure_has_its_own_request_id(self):
        client = self.make_client()
        with self.assertLogs("medassist.consultations", level="ERROR"):
            first = client.get(PATH).json()["request_id"]
            second = client.get(PATH).json()["request_id"]

        self.assertNotEqual(first, second)

    def test_system_endpoints_respond_while_the_database_is_down(self):
        client = self.make_client(UNREACHABLE_URL)
        with self.assertLogs("medassist.consultations", level="ERROR"):
            self.assertEqual(client.get(PATH).status_code, 503)

        self.assertEqual(
            client.get("/").json(), {"message": "MedAssist backend is running"}
        )
        self.assertEqual(client.get("/openapi.json").status_code, 200)
        for method in ("GET", "HEAD"):
            for headers in ({}, {"If-None-Match": "*"}):
                with self.subTest(method=method, headers=headers):
                    response = client.request(method, "/health", headers=headers)

                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.headers["cache-control"], "no-store")
                    if method == "HEAD":
                        self.assertEqual(response.content, b"")
                    else:
                        self.assertEqual(response.json()["status"], "ok")

    def test_allowed_frontend_can_read_service_errors(self):
        origin = "http://localhost:5173"
        client = self.make_client(origins=origin)
        with self.assertLogs("medassist.consultations", level="ERROR"):
            allowed = client.get(PATH, headers={"Origin": origin})
            blocked = client.get(PATH, headers={"Origin": "https://unlisted.example"})

        self.assert_service_error(allowed)
        self.assertEqual(allowed.headers["access-control-allow-origin"], origin)
        self.assertEqual(allowed.headers["access-control-expose-headers"], "X-Request-ID")
        self.assertNotIn("access-control-allow-origin", blocked.headers)

    def test_directory_is_read_only(self):
        client = self.make_client()
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            with self.subTest(method=method):
                self.assertEqual(client.request(method, PATH).status_code, 405)

    def test_openapi_documents_filters_and_responses(self):
        schema = self.make_client().get("/openapi.json").json()
        operation = schema["paths"][PATH]["get"]
        parameters = {item["name"]: item for item in operation["parameters"]}

        self.assertEqual(
            set(parameters),
            {"q", "specialty", "mode", "fee_state", "max_fee_minor", "limit", "offset"},
        )
        self.assertFalse(any(item["required"] for item in parameters.values()))
        self.assertEqual(set(operation["responses"]), {"200", "422", "503"})
        for status, model in (("200", "ConsultationPage"), ("503", "ServiceErrorResponse")):
            reference = operation["responses"][status]["content"]["application/json"][
                "schema"
            ]["$ref"]
            self.assertEqual(reference.rsplit("/", 1)[-1], model)

        models = schema["components"]["schemas"]
        self.assertEqual(models["FeeState"]["enum"], ["known", "free", "unknown"])
        self.assertEqual(models["ConsultationMode"]["enum"], ["in_person", "video", "phone"])
        self.assertEqual(
            set(models["ConsultationListing"]["required"]),
            set(models["ConsultationListing"]["properties"]),
        )
        self.assertEqual(
            set(models["ConsultationFee"]["required"]),
            {"state", "amount_minor", "currency", "basis"},
        )


class DatabaseSettingTests(unittest.TestCase):
    def read(self, value):
        with patch.dict("os.environ", {"MEDASSIST_DATABASE_URL": value}):
            return get_database_url()

    def test_unset_or_blank_means_no_database(self):
        self.assertIsNone(self.read(""))
        self.assertIsNone(self.read("   "))

    def test_postgresql_urls_use_the_psycopg_driver(self):
        for scheme in ("postgresql", "postgres", "postgresql+psycopg"):
            with self.subTest(scheme=scheme):
                url = self.read(f"{scheme}://user:secret@localhost:5432/medassist")

                self.assertEqual(url.drivername, "postgresql+psycopg")
                self.assertEqual(url.database, "medassist")
                self.assertEqual(url.password, "secret")

    def test_invalid_urls_stop_startup_without_revealing_the_value(self):
        for value in (
            "sqlite:///medassist.db",
            "mysql://user:hunter2@localhost/medassist",
            "postgresql://user:hunter2@localhost:5432",
            "hunter2 is not a url",
        ):
            with self.subTest(value=value):
                with self.assertRaises(ValueError) as raised:
                    self.read(value)
                self.assertNotIn("hunter2", str(raised.exception))
                with patch.dict("os.environ", {"MEDASSIST_DATABASE_URL": value}):
                    with self.assertRaises(ValueError):
                        create_app()


class FeeSchemaTests(unittest.TestCase):
    def test_the_three_fee_states_are_accepted(self):
        for fee in (
            {"state": "known", "amount_minor": 30000, "currency": "INR", "basis": "Listed"},
            {"state": "free", "amount_minor": 0, "currency": "INR", "basis": "Listed"},
            {"state": "unknown", "amount_minor": None, "currency": None, "basis": None},
        ):
            with self.subTest(state=fee["state"]):
                self.assertEqual(ConsultationFee(**fee).model_dump(mode="json"), fee)

    def test_mixed_fee_states_are_rejected(self):
        for fee in (
            {"state": "known", "amount_minor": None, "currency": "INR", "basis": "Listed"},
            {"state": "known", "amount_minor": 0, "currency": "INR", "basis": "Listed"},
            {"state": "known", "amount_minor": 30000, "currency": "INR", "basis": None},
            {"state": "known", "amount_minor": 30000, "currency": None, "basis": "Listed"},
            {"state": "known", "amount_minor": 30000, "currency": "USD", "basis": "Listed"},
            {"state": "known", "amount_minor": -1, "currency": "INR", "basis": "Listed"},
            {"state": "free", "amount_minor": 0, "currency": "INR", "basis": None},
            {"state": "free", "amount_minor": 0, "currency": "INR", "basis": "  "},
            {"state": "free", "amount_minor": None, "currency": None, "basis": "Listed"},
            {"state": "free", "amount_minor": 100, "currency": "INR", "basis": "Listed"},
            {"state": "unknown", "amount_minor": 0, "currency": None, "basis": None},
            {"state": "unknown", "amount_minor": None, "currency": "INR", "basis": None},
            {"state": "unknown", "amount_minor": None, "currency": None, "basis": "Listed"},
            {"state": "donation", "amount_minor": None, "currency": None, "basis": None},
        ):
            with self.subTest(fee=fee):
                with self.assertRaises(ValidationError):
                    ConsultationFee(**fee)


class SeedRecordTests(unittest.TestCase):
    def test_seed_has_nine_stable_fictional_listings(self):
        self.assertEqual(
            [listing["id"] for listing in FICTIONAL_LISTINGS],
            [f"c-0{number}" for number in range(1, 10)],
        )
        self.assertEqual(FICTIONAL_SOURCE["kind"], "fictional_seed")
        self.assertIsNone(FICTIONAL_SOURCE["url"])
        for listing in FICTIONAL_LISTINGS:
            with self.subTest(listing=listing["id"]):
                self.assertTrue(listing["provider_name"].endswith("(fictional)"))
                self.assertEqual(listing["source_id"], FICTIONAL_SOURCE["id"])
                self.assertEqual(listing["source_kind"], "fictional_seed")
                self.assertIsNone(listing["last_checked_on"])
                ConsultationFee(
                    state=listing["fee_state"],
                    amount_minor=listing["fee_amount_minor"],
                    currency=listing["fee_currency"],
                    basis=listing["fee_basis"],
                )

    def test_seed_fees_match_the_frontend_fixtures(self):
        fees = {
            listing["id"]: (listing["fee_state"], listing["fee_amount_minor"])
            for listing in FICTIONAL_LISTINGS
        }

        self.assertEqual(
            fees,
            {
                "c-01": ("known", 30000),
                "c-02": ("known", 19900),
                "c-03": ("free", 0),
                "c-04": ("known", 50000),
                "c-05": ("known", 60000),
                "c-06": ("unknown", None),
                "c-07": ("known", 45000),
                "c-08": ("free", 0),
                "c-09": ("unknown", None),
            },
        )


if __name__ == "__main__":
    unittest.main()
