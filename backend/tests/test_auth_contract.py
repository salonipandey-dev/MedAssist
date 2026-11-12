"""Sign-in and health profile checks that run without PostgreSQL.

They cover password hashing, request validation, the CSRF origin rule, query
parameter refusal, the no-store rule, session settings and the profile schema.
Behaviour against real tables is in test_health_profile_db.py.
"""

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import get_session_settings
from app.main import create_app
from app.schemas import HealthProfileUpdate, ProfileSection
from app.security import hash_password, verify_password

SIGN_IN = "/api/v1/auth/sign-in"
PROFILE = "/api/v1/me/health-profile"
ALLOWED_ORIGIN = "http://127.0.0.1:4173"
# Nothing listens on port 9 locally, so connections are refused immediately.
UNREACHABLE_URL = "postgresql://medassist:not-a-real-secret@127.0.0.1:9/medassist"
SECRET_PASSWORD = "fictional-secret-password-value"


def section(state="not_recorded", entries=()):
    return {"state": state, "entries": list(entries)}


def profile_body(**overrides):
    body = {
        "version": 0,
        "medicines": section(),
        "allergies": section(),
        "conditions": section(),
    }
    body.update(overrides)
    return body


class PrivateEndpointContractTests(unittest.TestCase):
    def make_client(self, database_url="", origins=ALLOWED_ORIGIN, **extra):
        environment = {
            "MEDASSIST_DATABASE_URL": database_url,
            "MEDASSIST_CORS_ORIGINS": origins,
            **extra,
        }
        with patch.dict("os.environ", environment):
            application = create_app()
        client = TestClient(application)
        client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)
        return client

    def test_private_responses_are_never_stored(self):
        client = self.make_client()
        for method, path, kwargs in (
            ("GET", "/api/v1/auth/session", {}),
            ("GET", PROFILE, {}),
            ("GET", PROFILE + "?account_id=1", {}),
            ("POST", SIGN_IN, {"json": {"email": "a@example.test"}}),
            ("POST", "/api/v1/auth/sign-out", {}),
        ):
            with self.subTest(method=method, path=path):
                response = client.request(method, path, **kwargs)
                self.assertEqual(response.headers["cache-control"], "no-store")
                self.assertEqual(response.headers["pragma"], "no-cache")

    def test_without_a_database_private_routes_report_unavailable(self):
        # A session cookie makes the routes look the session up in PostgreSQL.
        cookie = {"Cookie": "medassist_session=fictional-session-token"}
        for database_url in ("", UNREACHABLE_URL):
            client = self.make_client(database_url)
            with self.subTest(database_url=bool(database_url)):
                for method, path, kwargs in (
                    ("GET", PROFILE, {"headers": cookie}),
                    ("GET", "/api/v1/auth/session", {"headers": cookie}),
                    (
                        "POST",
                        SIGN_IN,
                        {"json": {"email": "a@example.test", "password": SECRET_PASSWORD}},
                    ),
                ):
                    response = client.request(method, path, **kwargs)
                    self.assertEqual(response.status_code, 503, response.text)
                    body = response.json()
                    self.assertEqual(body["code"], "service_unavailable")
                    self.assertEqual(body["request_id"], response.headers["x-request-id"])
                    self.assertNotIn(SECRET_PASSWORD, response.text)
                    self.assertNotIn("not-a-real-secret", response.text)

    def test_validation_errors_do_not_echo_submitted_values(self):
        response = self.make_client().post(
            SIGN_IN,
            json={"email": "a@example.test", "password": SECRET_PASSWORD, "remember": True},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], "invalid_input")
        self.assertNotIn(SECRET_PASSWORD, response.text)
        self.assertEqual(response.json()["detail"][0]["loc"], ["body", "remember"])
        for item in response.json()["detail"]:
            self.assertEqual(set(item), {"loc", "msg", "type"})

    def test_supplying_an_owner_or_profile_id_is_refused_before_any_lookup(self):
        client = self.make_client()
        for field in ("account_id", "owner_id", "profile_id", "patient_id", "user_id"):
            with self.subTest(field=field):
                response = client.put(PROFILE, json=profile_body(**{field: 2}))
                self.assertEqual(response.status_code, 422, response.text)
                self.assertIn(
                    {
                        "loc": ["body", field],
                        "msg": "The profile owner comes from your sign-in and cannot be supplied.",
                        "type": "extra_forbidden",
                    },
                    response.json()["detail"],
                )
        for query in ("account_id=2", "profile_id=2", "anything=1"):
            with self.subTest(query=query):
                response = client.get(f"{PROFILE}?{query}")
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["code"], "unexpected_parameter")
        self.assertEqual(client.get(PROFILE + "/2").status_code, 404)

    def test_writes_from_unlisted_pages_are_refused(self):
        client = self.make_client()
        for origin in ("https://attacker.example", "null", "http://127.0.0.1:4174"):
            with self.subTest(origin=origin):
                for method, path, body in (
                    ("POST", SIGN_IN, {"email": "a@example.test", "password": "x"}),
                    ("PUT", PROFILE, profile_body()),
                    ("POST", "/api/v1/auth/sign-out", None),
                ):
                    response = client.request(
                        method, path, json=body, headers={"Origin": origin}
                    )
                    self.assertEqual(response.status_code, 403, response.text)
                    self.assertEqual(response.json()["code"], "origin_not_allowed")
                    self.assertNotIn("access-control-allow-origin", response.headers)

    def test_without_a_cookie_no_database_lookup_is_needed(self):
        client = self.make_client(UNREACHABLE_URL)
        for path in (PROFILE, "/api/v1/auth/session"):
            with self.subTest(path=path):
                response = client.get(path)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json()["code"], "not_signed_in")

    def test_allowed_and_same_origin_writes_reach_the_database_step(self):
        client = self.make_client()
        for origin in (ALLOWED_ORIGIN, "http://testserver"):
            with self.subTest(origin=origin):
                response = client.post(
                    SIGN_IN,
                    json={"email": "a@example.test", "password": "x"},
                    headers={"Origin": origin},
                )
                self.assertEqual(response.status_code, 503)

    def test_writes_must_be_json(self):
        client = self.make_client()
        for method, path in (("POST", SIGN_IN), ("PUT", PROFILE)):
            with self.subTest(method=method):
                response = client.request(
                    method,
                    path,
                    content=b"email=a@example.test",
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                self.assertEqual(response.status_code, 415)
                self.assertEqual(response.json()["code"], "unsupported_media_type")

    def test_credentialed_preflight_is_limited_to_configured_origins(self):
        client = self.make_client()
        request_headers = {
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "content-type, x-csrf-token",
        }
        response = client.options(PROFILE, headers=request_headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], ALLOWED_ORIGIN)
        self.assertEqual(response.headers["access-control-allow-credentials"], "true")
        self.assertIn("x-csrf-token", response.headers["access-control-allow-headers"].lower())

        for origin, method in (("https://attacker.example", "PUT"), (ALLOWED_ORIGIN, "DELETE")):
            with self.subTest(origin=origin, method=method):
                headers = {
                    **request_headers,
                    "Origin": origin,
                    "Access-Control-Request-Method": method,
                }
                response = client.options(PROFILE, headers=headers)
                self.assertEqual(response.status_code, 400)

    def test_medication_check_follows_the_private_route_rules(self):
        path = "/api/v1/me/medication-check"
        client = self.make_client(UNREACHABLE_URL)
        signed_out = client.get(path)
        self.assertEqual(signed_out.status_code, 401)
        self.assertEqual(signed_out.json()["code"], "not_signed_in")
        self.assertEqual(signed_out.headers["cache-control"], "no-store")
        self.assertEqual(client.get(path + "?account_id=2").status_code, 400)
        unavailable = client.get(
            path, headers={"Cookie": "medassist_session=fictional-session-token"}
        )
        self.assertEqual(unavailable.status_code, 503)
        self.assertEqual(unavailable.headers["cache-control"], "no-store")
        self.assertEqual(client.put(path, json={}).status_code, 405)

    def test_openapi_documents_the_private_routes_without_an_owner_parameter(self):
        schema = self.make_client().get("/openapi.json").json()
        for path, methods in (
            ("/api/v1/auth/sign-in", {"post"}),
            ("/api/v1/auth/sign-out", {"post"}),
            ("/api/v1/auth/session", {"get"}),
            (PROFILE, {"get", "put"}),
            ("/api/v1/me/medication-check", {"get"}),
        ):
            with self.subTest(path=path):
                self.assertEqual(set(schema["paths"][path]), methods)
                for operation in schema["paths"][path].values():
                    self.assertEqual(operation.get("parameters", []), [])
        self.assertIn("409", schema["paths"][PROFILE]["put"]["responses"])


class SessionSettingsTests(unittest.TestCase):
    def test_defaults(self):
        unset = {
            "MEDASSIST_SESSION_IDLE_MINUTES": "",
            "MEDASSIST_SESSION_MAX_HOURS": "",
            "MEDASSIST_COOKIE_SECURE": "",
        }
        with patch.dict("os.environ", unset):
            settings = get_session_settings()
        self.assertEqual((settings.idle_minutes, settings.max_hours), (30, 8))
        self.assertFalse(settings.always_secure)

    def test_invalid_settings_fail_during_app_creation(self):
        for name, value in (
            ("MEDASSIST_SESSION_IDLE_MINUTES", "0"),
            ("MEDASSIST_SESSION_IDLE_MINUTES", "ten"),
            ("MEDASSIST_SESSION_MAX_HOURS", "1000"),
            ("MEDASSIST_COOKIE_SECURE", "false"),
        ):
            with self.subTest(name=name, value=value):
                with patch.dict("os.environ", {name: value, "MEDASSIST_CORS_ORIGINS": ""}):
                    with self.assertRaisesRegex(ValueError, name):
                        create_app()

    def test_cookie_secure_true_is_accepted(self):
        with patch.dict("os.environ", {"MEDASSIST_COOKIE_SECURE": "true"}):
            self.assertTrue(get_session_settings().always_secure)


class PasswordTests(unittest.TestCase):
    def test_passwords_are_hashed_with_argon2id(self):
        stored = hash_password(SECRET_PASSWORD)

        self.assertTrue(stored.startswith("$argon2id$"))
        self.assertNotIn(SECRET_PASSWORD, stored)
        self.assertTrue(verify_password(stored, SECRET_PASSWORD))
        self.assertFalse(verify_password(stored, SECRET_PASSWORD + "x"))

    def test_unknown_accounts_and_damaged_hashes_never_verify(self):
        self.assertFalse(verify_password(None, SECRET_PASSWORD))
        self.assertFalse(verify_password("not-a-hash", SECRET_PASSWORD))


class ProfileSchemaTests(unittest.TestCase):
    def test_not_recorded_and_none_are_different_states_without_entries(self):
        for state in ("not_recorded", "none"):
            with self.subTest(state=state):
                self.assertEqual(ProfileSection.model_validate(section(state)).entries, [])
                with self.assertRaises(ValidationError):
                    ProfileSection.model_validate(section(state, [{"name": "Velorin"}]))

    def test_recorded_needs_at_least_one_entry(self):
        with self.assertRaisesRegex(ValidationError, "Add at least one entry"):
            ProfileSection.model_validate(section("recorded"))

    def test_entries_are_trimmed_and_blank_notes_become_null(self):
        parsed = ProfileSection.model_validate(
            section("recorded", [{"name": "  Velorin (fictional) ", "note": "   "}])
        )

        self.assertEqual(parsed.entries[0].name, "Velorin (fictional)")
        self.assertIsNone(parsed.entries[0].note)

    def test_invalid_entries_are_refused(self):
        for entries, message in (
            ([{"name": "   "}], "Enter a name"),
            ([{"name": "x" * 121}], "120 characters"),
            ([{"name": "Velorin", "note": "x" * 301}], "300 characters"),
            ([{"name": "Line\nbreak"}], "single line"),
            ([{"name": "Velorin"}, {"name": "VELORIN"}], "only once"),
            ([{"name": "Velorin", "dose": "1"}], "Extra inputs"),
            ([{"name": 12}], "valid string"),
            ([{"name": f"Item {n}"} for n in range(31)], "at most 30"),
        ):
            with self.subTest(message=message):
                with self.assertRaisesRegex(ValidationError, message):
                    ProfileSection.model_validate(section("recorded", entries))

    def test_update_needs_all_sections_and_a_non_negative_version(self):
        for body in (
            {k: v for k, v in profile_body().items() if k != "allergies"},
            profile_body(version=-1),
            profile_body(medicines=section("unknown")),
        ):
            with self.subTest(body=body):
                with self.assertRaises(ValidationError):
                    HealthProfileUpdate.model_validate(body)
