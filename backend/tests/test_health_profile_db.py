"""Sign-in, sessions and private health profiles against a real PostgreSQL database.

Set MEDASSIST_TEST_DATABASE_URL to a database whose name ends in "_test".
These tests drop and recreate tables in it, so they refuse any other name.
Without the variable they are skipped and the rest of the suite still runs.

Every person and entry here is fictional.
"""

import hashlib
import json
import logging
import os
import unittest
from http.cookies import SimpleCookie
from pathlib import Path
from unittest.mock import patch

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app.config import TEST_DATABASE_URL_ENV, get_database_url
from app.db import create_database_engine
from app.main import create_app
from app.seed import seed
from app.seed_demo_accounts import DEMO_ACCOUNTS, seed_demo_accounts
from app.security import SESSION_COOKIE

SIGN_IN = "/api/v1/auth/sign-in"
SIGN_OUT = "/api/v1/auth/sign-out"
SESSION = "/api/v1/auth/session"
PROFILE = "/api/v1/me/health-profile"
ORIGIN = "http://127.0.0.1:4173"
PATIENT_A, PATIENT_B = DEMO_ACCOUNTS
NEW_TABLES = {"accounts", "auth_sessions", "health_profiles", "health_profile_entries"}
DIRECTORY_TABLES = {"consultation_listings", "consultation_sources"}

engine = None
migration_log = {}


def _listings():
    with engine.connect() as connection:
        return connection.execute(text("SELECT * FROM consultation_listings ORDER BY id")).all()


def _tables():
    return set(inspect(engine).get_table_names()) - {"alembic_version"}


def setUpModule():
    global engine
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
    engine = create_database_engine(url)

    # A database that already has the consultation schema and its records.
    command.downgrade(config, "base")
    command.upgrade(config, "0001")
    seed(engine)
    before = _listings()
    command.upgrade(config, "head")
    migration_log["existing_directory_kept"] = before == _listings() and len(before) == 9
    migration_log["existing_tables"] = _tables()
    command.downgrade(config, "0001")
    migration_log["downgrade_tables"] = _tables()
    migration_log["downgrade_kept_directory"] = before == _listings()

    # A completely empty database.
    command.downgrade(config, "base")
    migration_log["empty_tables"] = _tables()
    command.upgrade(config, "head")
    migration_log["fresh_tables"] = _tables()

    seed(engine)
    seed_demo_accounts(engine)


def tearDownModule():
    if engine is not None:
        engine.dispose()


def parse_set_cookie(response):
    """Return the session Morsel from Set-Cookie, or None when absent."""
    for header in response.headers.get_list("set-cookie"):
        cookie = SimpleCookie()
        cookie.load(header)
        if SESSION_COOKIE in cookie:
            return cookie[SESSION_COOKIE]
    return None


class Browser:
    """One browser profile. The session cookie and CSRF token are held here and
    sent explicitly, so a test can copy, tamper with or replay them."""

    def __init__(self, client):
        self.client = client
        self.token = None
        self.csrf = None

    def request(self, method, path, *, csrf=None, origin=ORIGIN, headers=None, **kwargs):
        headers = dict(headers or {})
        if self.token:
            headers["Cookie"] = f"{SESSION_COOKIE}={self.token}"
        if method in ("POST", "PUT"):
            if origin:
                headers["Origin"] = origin
            token = self.csrf if csrf is None else csrf
            if token:
                headers["X-CSRF-Token"] = token
        self.client.cookies.clear()
        response = self.client.request(method, path, headers=headers, **kwargs)
        self.client.cookies.clear()
        morsel = parse_set_cookie(response)
        if morsel is not None:
            self.token = morsel.value or None
        return response

    def sign_in(self, account):
        response = self.request(
            "POST", SIGN_IN, json={"email": account["email"], "password": account["password"]}
        )
        assert response.status_code == 200, response.text
        self.csrf = response.json()["csrf_token"]
        return response

    def profile(self):
        response = self.request("GET", PROFILE)
        assert response.status_code == 200, response.text
        return response.json()

    def save(self, body, **kwargs):
        return self.request("PUT", PROFILE, json=body, **kwargs)


def section(state="not_recorded", *names):
    return {
        "state": state,
        "entries": [{"name": name, "note": None} for name in names],
    }


def body_for(version, medicines=None, allergies=None, conditions=None):
    return {
        "version": version,
        "medicines": medicines or section(),
        "allergies": allergies or section(),
        "conditions": conditions or section(),
    }


A_PROFILE = {
    "medicines": {
        "state": "recorded",
        "entries": [
            {"name": "Tarvexol (fictional)", "note": "Taken with breakfast"},
            {"name": "Mirelune (fictional)", "note": None},
        ],
    },
    "allergies": {"state": "recorded", "entries": [{"name": "Sample pollen X", "note": "Rash"}]},
    "conditions": {"state": "none", "entries": []},
}


class DatabaseTestCase(unittest.TestCase):
    def setUp(self):
        seed_demo_accounts(engine, reset_profiles=True)

    def make_client(self, base_url="http://testserver", **settings):
        url = engine.url.render_as_string(hide_password=False)
        environment = {
            "MEDASSIST_DATABASE_URL": url,
            "MEDASSIST_CORS_ORIGINS": ORIGIN,
            **settings,
        }
        with patch.dict("os.environ", environment):
            application = create_app()
        client = TestClient(application, base_url=base_url)
        client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)
        return client

    def browser(self, client=None):
        return Browser(client or self.make_client())

    def sql(self, statement, **params):
        with engine.begin() as connection:
            return connection.execute(text(statement), params)

    def account_id(self, account):
        return self.sql(
            "SELECT id FROM accounts WHERE email = :email", email=account["email"]
        ).scalar_one()


class MigrationTests(DatabaseTestCase):
    def test_migration_is_at_head(self):
        version = self.sql("SELECT version_num FROM alembic_version").scalar_one()
        self.assertEqual(version, "0002")

    def test_fresh_database_migrates_to_every_table(self):
        self.assertEqual(migration_log["empty_tables"], set())
        self.assertEqual(migration_log["fresh_tables"], NEW_TABLES | DIRECTORY_TABLES)

    def test_database_with_the_consultation_schema_upgrades_and_downgrades_cleanly(self):
        self.assertTrue(migration_log["existing_directory_kept"])
        self.assertEqual(migration_log["existing_tables"], NEW_TABLES | DIRECTORY_TABLES)
        self.assertEqual(migration_log["downgrade_tables"], DIRECTORY_TABLES)
        self.assertTrue(migration_log["downgrade_kept_directory"])

    def test_database_rejects_inconsistent_rows(self):
        a_id = self.account_id(PATIENT_A)
        for statement in (
            "INSERT INTO accounts (email, display_name, role, password_hash)"
            " VALUES ('Upper@Example.test', 'X', 'patient', '$argon2id$x')",
            "INSERT INTO accounts (email, display_name, role, password_hash)"
            " VALUES ('plain@example.test', 'X', 'patient', 'plaintext')",
            "INSERT INTO accounts (email, display_name, role, password_hash)"
            " VALUES ('admin@example.test', 'X', 'admin', '$argon2id$x')",
            f"INSERT INTO health_profiles (account_id, version, medicines_state,"
            f" allergies_state, conditions_state) VALUES ({a_id}, 1, 'unknown', 'none', 'none')",
        ):
            with self.subTest(statement=statement[:60]):
                with self.assertRaises(IntegrityError):
                    self.sql(statement)


class SignInTests(DatabaseTestCase):
    def test_sign_in_sets_a_strict_http_only_cookie_and_stores_only_a_digest(self):
        browser = self.browser()
        response = browser.sign_in(PATIENT_A)

        morsel = parse_set_cookie(response)
        self.assertTrue(morsel["httponly"])
        self.assertEqual(morsel["samesite"].lower(), "strict")
        self.assertEqual(morsel["path"], "/api/v1")
        self.assertEqual(morsel["max-age"], str(8 * 3600))
        self.assertFalse(morsel["secure"])
        body = response.json()
        self.assertEqual(body["account"]["display_name"], "Patient A (fictional)")
        self.assertNotIn(browser.token, response.text)
        self.assertEqual(response.headers["cache-control"], "no-store")

        stored = self.sql("SELECT token_hash FROM auth_sessions").scalars().all()
        self.assertIn(hashlib.sha256(browser.token.encode()).hexdigest(), stored)
        dump = " ".join(str(row) for row in self.sql("SELECT * FROM auth_sessions").all())
        self.assertNotIn(browser.token, dump)

    def test_https_requests_get_a_secure_cookie(self):
        response = self.browser(self.make_client(base_url="https://testserver")).request(
            "POST",
            SIGN_IN,
            origin="https://testserver",
            json={"email": PATIENT_A["email"], "password": PATIENT_A["password"]},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(parse_set_cookie(response)["secure"])

    def test_cookie_secure_setting_forces_secure_behind_a_proxy(self):
        browser = self.browser(self.make_client(MEDASSIST_COOKIE_SECURE="true"))
        self.assertTrue(parse_set_cookie(browser.sign_in(PATIENT_A))["secure"])

    def test_passwords_are_stored_as_argon2id(self):
        for stored in self.sql("SELECT password_hash FROM accounts").scalars():
            self.assertTrue(stored.startswith("$argon2id$"))

    def test_wrong_password_and_unknown_email_get_the_same_refusal(self):
        browser = self.browser()
        answers = []
        for email, password in (
            (PATIENT_A["email"], "wrong-password"),
            ("nobody@example.test", PATIENT_A["password"]),
        ):
            response = browser.request(
                "POST", SIGN_IN, json={"email": email, "password": password}
            )
            self.assertEqual(response.status_code, 401)
            self.assertIsNone(parse_set_cookie(response))
            answers.append(response.json())
        self.assertEqual(answers[0], answers[1])
        self.assertEqual(answers[0]["code"], "invalid_credentials")

    def test_email_is_matched_without_case_or_surrounding_spaces(self):
        response = self.browser().request(
            "POST",
            SIGN_IN,
            json={"email": "  PATIENT.A@Example.TEST ", "password": PATIENT_A["password"]},
        )
        self.assertEqual(response.status_code, 200)

    def test_session_endpoint_reports_the_account_after_a_reload(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)

        response = browser.request("GET", SESSION)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["account"]["email"], PATIENT_A["email"])
        self.assertEqual(response.json()["csrf_token"], browser.csrf)

    def test_signing_in_again_ends_the_previous_session(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)
        old_token = browser.token
        browser.sign_in(PATIENT_B)

        replay = self.browser()
        replay.token = old_token
        self.assertEqual(replay.request("GET", SESSION).status_code, 401)
        self.assertEqual(browser.request("GET", SESSION).json()["account"]["email"], PATIENT_B["email"])

    def test_logs_do_not_contain_credentials_or_profile_contents(self):
        records = []

        class Capture(logging.Handler):
            def emit(self, record):
                records.append(self.format(record))

        # INFO is where a deployment would usually log, and where SQLAlchemy
        # writes each statement; bound values must not appear there.
        handler = Capture(level=logging.INFO)
        root = logging.getLogger()
        previous = root.level
        root.addHandler(handler)
        root.setLevel(logging.INFO)
        self.addCleanup(root.removeHandler, handler)
        self.addCleanup(root.setLevel, previous)

        browser = self.browser()
        browser.request(
            "POST", SIGN_IN, json={"email": PATIENT_A["email"], "password": "wrong-password"}
        )
        browser.sign_in(PATIENT_A)
        browser.save(body_for(0, **A_PROFILE))

        text_logged = "\n".join(records)
        for secret in (
            "wrong-password",
            PATIENT_A["password"],
            PATIENT_A["email"],
            browser.token,
            browser.csrf,
            "Tarvexol",
            "Sample pollen X",
        ):
            self.assertNotIn(secret, text_logged)


class ProfilePersistenceTests(DatabaseTestCase):
    def test_new_profile_is_empty_and_not_recorded(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)

        profile = browser.profile()

        self.assertEqual(profile["version"], 0)
        self.assertIsNone(profile["updated_at"])
        for name in ("medicines", "allergies", "conditions"):
            self.assertEqual(profile[name], {"state": "not_recorded", "entries": []})

    def test_saved_entries_survive_a_new_app_instance_with_the_same_cookie(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)
        response = browser.save(body_for(0, **A_PROFILE))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["version"], 1)

        # A new application instance stands in for a FastAPI restart: nothing
        # is kept in memory, so the session and profile must come from PostgreSQL.
        restarted = Browser(self.make_client())
        restarted.token = browser.token
        profile = restarted.profile()

        self.assertEqual(profile["version"], 1)
        for name, expected in A_PROFILE.items():
            self.assertEqual(profile[name], expected)

    def test_none_and_not_recorded_round_trip_separately(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)
        browser.save(body_for(0, allergies=section("none")))

        profile = browser.profile()

        self.assertEqual(profile["allergies"]["state"], "none")
        self.assertEqual(profile["medicines"]["state"], "not_recorded")
        self.assertEqual(
            self.sql(
                "SELECT allergies_state, medicines_state FROM health_profiles"
                " WHERE account_id = :id",
                id=self.account_id(PATIENT_A),
            ).one(),
            ("none", "not_recorded"),
        )

    def test_removing_every_entry_and_editing_order_is_saved(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)
        browser.save(body_for(0, **A_PROFILE))
        reordered = {
            **A_PROFILE,
            "medicines": section("recorded", "Mirelune (fictional)", "Tarvexol (fictional)"),
            "allergies": section("not_recorded"),
        }

        self.assertEqual(browser.save(body_for(1, **reordered)).status_code, 200)

        profile = browser.profile()
        self.assertEqual(
            [entry["name"] for entry in profile["medicines"]["entries"]],
            ["Mirelune (fictional)", "Tarvexol (fictional)"],
        )
        self.assertEqual(profile["allergies"], {"state": "not_recorded", "entries": []})

    def test_invalid_saves_change_nothing(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)
        browser.save(body_for(0, **A_PROFILE))
        for body in (
            body_for(1, medicines=section("recorded")),
            body_for(1, medicines=section("recorded", "Velorin", "velorin")),
            body_for(1, conditions={"state": "none", "entries": [{"name": "X"}]}),
        ):
            with self.subTest(body=body):
                response = browser.save(body)
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json()["code"], "invalid_input")
        self.assertEqual(browser.profile()["version"], 1)

    def test_a_failure_part_way_through_a_save_rolls_everything_back(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)
        browser.save(body_for(0, **A_PROFILE))
        # Make the entry insert fail after the profile row has been updated.
        self.sql(
            "ALTER TABLE health_profile_entries ADD CONSTRAINT ck_test_force_failure"
            " CHECK (name <> 'Force failure (fictional)')"
        )
        self.addCleanup(
            self.sql,
            "ALTER TABLE health_profile_entries DROP CONSTRAINT IF EXISTS ck_test_force_failure",
        )

        response = browser.save(
            body_for(1, conditions=section("recorded", "Force failure (fictional)"))
        )

        self.assertEqual(response.status_code, 503)
        profile = browser.profile()
        self.assertEqual(profile["version"], 1)
        self.assertEqual(profile["medicines"], A_PROFILE["medicines"])


class IsolationTests(DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.a = self.browser()
        self.a.sign_in(PATIENT_A)
        self.assertEqual(self.a.save(body_for(0, **A_PROFILE)).status_code, 200)
        self.b = self.browser()
        self.b.sign_in(PATIENT_B)
        self.a_rows = self.a_snapshot()

    def a_snapshot(self):
        a_id = self.account_id(PATIENT_A)
        return (
            self.sql("SELECT * FROM health_profiles WHERE account_id = :id", id=a_id).all(),
            self.sql(
                "SELECT section, position, name, note FROM health_profile_entries"
                " WHERE account_id = :id ORDER BY section, position",
                id=a_id,
            ).all(),
        )

    def test_each_patient_sees_only_their_own_profile(self):
        b_profile = self.b.profile()

        self.assertEqual(
            b_profile["medicines"]["entries"],
            [{"name": "Velorin (fictional)", "note": "Invented entry for Patient B"}],
        )
        self.assertEqual(b_profile["allergies"]["state"], "none")
        self.assertNotIn("Tarvexol", str(b_profile))
        self.assertEqual(self.a.profile()["medicines"], A_PROFILE["medicines"])

    def test_tampered_owner_fields_and_parameters_cannot_reach_another_profile(self):
        a_id = self.account_id(PATIENT_A)
        for field in ("account_id", "profile_id", "owner_id", "patient_id"):
            with self.subTest(field=field):
                tampered = {**body_for(1, medicines=section("recorded", "Overwrite")), field: a_id}
                response = self.b.save(tampered)
                self.assertEqual(response.status_code, 422)
        for query in (f"account_id={a_id}", f"profile_id={a_id}", f"owner={PATIENT_A['email']}"):
            with self.subTest(query=query):
                response = self.b.request("GET", f"{PROFILE}?{query}")
                self.assertEqual(response.status_code, 400)
                self.assertNotIn("Tarvexol", response.text)
        self.assertEqual(self.b.request("GET", f"{PROFILE}/{a_id}").status_code, 404)

        # B's own valid save changes only B's rows.
        b_version = self.b.profile()["version"]
        response = self.b.save(body_for(b_version, medicines=section("recorded", "Overwrite")))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.a_snapshot(), self.a_rows)

    def test_a_csrf_token_only_works_with_its_own_session(self):
        # An empty value sends no header at all; A's token belongs to another session.
        for csrf in ("", "wrong-token", self.a.csrf):
            with self.subTest(csrf=csrf[:5]):
                response = self.b.save(body_for(1), csrf=csrf)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()["code"], "csrf_failed")
        self.assertEqual(self.a_snapshot(), self.a_rows)

    def test_a_valid_session_cannot_be_used_from_an_unlisted_page(self):
        response = self.a.save(body_for(1), origin="https://attacker.example")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "origin_not_allowed")
        self.assertEqual(self.a_snapshot(), self.a_rows)


class SessionEndTests(DatabaseTestCase):
    def test_requests_without_a_session_are_refused(self):
        browser = self.browser()
        for method, path, kwargs in (
            ("GET", PROFILE, {}),
            ("GET", SESSION, {}),
            ("PUT", PROFILE, {"json": body_for(0)}),
        ):
            with self.subTest(method=method, path=path):
                response = browser.request(method, path, **kwargs)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json()["code"], "not_signed_in")

    def test_signed_out_sessions_cannot_be_reused(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)
        old_token = browser.token

        response = browser.request("POST", SIGN_OUT)

        self.assertEqual(response.status_code, 204)
        self.assertEqual(parse_set_cookie(response).value, "")
        self.assertIsNone(browser.token)
        replay = self.browser()
        for method, path, kwargs in (("GET", PROFILE, {}), ("PUT", PROFILE, {"json": body_for(0)})):
            with self.subTest(method=method):
                # Each refusal clears the cookie, so put the old one back every time.
                replay.token, replay.csrf = old_token, browser.csrf
                response = replay.request(method, path, **kwargs)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json()["code"], "session_expired")
                self.assertEqual(parse_set_cookie(response).value, "")

    def test_sign_out_needs_the_csrf_token(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)

        response = browser.request("POST", SIGN_OUT, csrf="wrong-token")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(browser.request("GET", SESSION).status_code, 200)

    def test_idle_and_absolute_expiry_end_the_session(self):
        for change in (
            "SET idle_expires_at = now() - interval '1 minute'",
            "SET idle_expires_at = now() - interval '1 minute',"
            " expires_at = now() - interval '1 minute'",
        ):
            with self.subTest(change=change):
                browser = self.browser()
                browser.sign_in(PATIENT_A)
                digest = hashlib.sha256(browser.token.encode()).hexdigest()
                self.sql(f"UPDATE auth_sessions {change} WHERE token_hash = :h", h=digest)

                response = browser.request("GET", PROFILE)

                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json()["code"], "session_expired")
                self.assertIsNone(browser.token)

    def test_each_request_extends_the_idle_timer_up_to_the_maximum_age(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)
        digest = hashlib.sha256(browser.token.encode()).hexdigest()
        self.sql(
            "UPDATE auth_sessions SET idle_expires_at = now() + interval '1 minute'"
            " WHERE token_hash = :h",
            h=digest,
        )

        browser.request("GET", SESSION)

        remaining = self.sql(
            "SELECT extract(epoch FROM idle_expires_at - now()) FROM auth_sessions"
            " WHERE token_hash = :h",
            h=digest,
        ).scalar_one()
        self.assertGreater(remaining, 29 * 60)

        self.sql(
            "UPDATE auth_sessions SET expires_at = now() + interval '2 minutes',"
            " idle_expires_at = now() + interval '1 minute' WHERE token_hash = :h",
            h=digest,
        )
        browser.request("GET", SESSION)
        capped = self.sql(
            "SELECT idle_expires_at = expires_at FROM auth_sessions WHERE token_hash = :h",
            h=digest,
        ).scalar_one()
        self.assertTrue(capped)


class ConflictTests(DatabaseTestCase):
    def test_a_stale_save_from_another_tab_gets_a_conflict(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)
        self.assertEqual(browser.save(body_for(0, **A_PROFILE)).status_code, 200)
        tab_one = browser.profile()
        tab_two = browser.profile()

        first = browser.save(
            body_for(tab_one["version"], **{**A_PROFILE, "conditions": section("none")})
        )
        second = browser.save(
            body_for(tab_two["version"], medicines=section("recorded", "Stale edit"))
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json()["code"], "version_conflict")
        self.assertEqual(second.json()["current_version"], 2)
        self.assertNotIn("Stale edit", str(browser.profile()))

    def test_a_first_save_conflicts_when_another_tab_saved_first(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)
        self.assertEqual(browser.save(body_for(0)).status_code, 200)

        response = browser.save(body_for(0, medicines=section("recorded", "Late")))

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["current_version"], 1)


class SignedOutPublicRoutesTests(DatabaseTestCase):
    def test_health_and_consultation_search_need_no_sign_in(self):
        client = self.make_client()
        self.assertEqual(client.get("/health").json()["status"], "ok")
        response = client.get("/api/v1/consultations", params={"q": "clinic"})
        self.assertEqual(response.status_code, 200)
        self.assertGreater(response.json()["total"], 0)
        self.assertNotIn("set-cookie", response.headers)


class DemoSeedTests(DatabaseTestCase):
    def test_seed_is_repeatable_and_keeps_saved_profiles_unless_reset(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)
        browser.save(body_for(0, **A_PROFILE))

        seed_demo_accounts(engine)
        self.assertEqual(self.sql("SELECT count(*) FROM accounts").scalar_one(), 2)
        self.assertEqual(browser.profile()["version"], 1)

        seed_demo_accounts(engine, reset_profiles=True)
        self.assertEqual(browser.request("GET", PROFILE).json()["code"], "session_expired")
        fresh = self.browser()
        fresh.sign_in(PATIENT_A)
        self.assertEqual(fresh.profile()["version"], 0)


CHECK = "/api/v1/me/medication-check"


class MedicationCheckTests(DatabaseTestCase):
    """The demo medication check reads each patient's own saved profile."""

    def check(self, browser):
        response = browser.request("GET", CHECK)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.headers["cache-control"], "no-store")
        return response.json()

    def test_signed_out_and_ended_sessions_are_refused(self):
        anonymous = self.browser()
        response = anonymous.request("GET", CHECK)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "not_signed_in")

        browser = self.browser()
        browser.sign_in(PATIENT_A)
        digest = hashlib.sha256(browser.token.encode()).hexdigest()
        self.sql(
            "UPDATE auth_sessions SET idle_expires_at = now() - interval '1 minute'"
            " WHERE token_hash = :h",
            h=digest,
        )
        response = browser.request("GET", CHECK)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "session_expired")

    def test_each_account_gets_results_from_its_own_profile(self):
        a, b = self.browser(), self.browser()
        a.sign_in(PATIENT_A)
        b.sign_in(PATIENT_B)
        a.save(
            body_for(
                0,
                medicines=section("recorded", "Brivanol 250 tablets", "Coldaway Day Relief"),
                allergies=section("none"),
                conditions=section("none"),
            )
        )

        a_result, b_result = self.check(a), self.check(b)

        self.assertEqual(a_result["outcome"], "matches_found")
        self.assertEqual([m["rule_id"] for m in a_result["matches"]], ["DEMO-DUP-001"])
        self.assertEqual(a_result["profile_version"], 1)
        # B's seeded profile: Velorin, allergies none, conditions not recorded.
        self.assertEqual(b_result["outcome"], "more_information_needed")
        self.assertEqual(b_result["matches"], [])
        self.assertEqual([m["section"] for m in b_result["missing"]], ["conditions"])
        self.assertEqual(
            [e["matched_id"] for e in b_result["recognised"]], ["prd-velorin"]
        )
        self.assertNotIn("Brivanol", json.dumps(b_result))
        self.assertEqual(b_result["fixture"]["version"], "1.0.0")

    def test_the_owner_cannot_be_chosen_by_the_request(self):
        browser = self.browser()
        browser.sign_in(PATIENT_B)
        a_id = self.account_id(PATIENT_A)
        for query in (f"account_id={a_id}", f"profile_id={a_id}"):
            with self.subTest(query=query):
                response = browser.request("GET", f"{CHECK}?{query}")
                self.assertEqual(response.status_code, 400)
        self.assertEqual(browser.request("GET", f"{CHECK}/{a_id}").status_code, 404)
        self.assertEqual(browser.request("POST", CHECK, json={}).status_code, 405)

    def test_removing_a_medicine_clears_the_duplicate_warning(self):
        browser = self.browser()
        browser.sign_in(PATIENT_A)
        browser.save(
            body_for(
                0,
                medicines=section("recorded", "Coldaway Day Relief", "Brivanol 250 tablets"),
                allergies=section("none"),
                conditions=section("none"),
            )
        )
        self.assertEqual([m["rule_id"] for m in self.check(browser)["matches"]], ["DEMO-DUP-001"])

        browser.save(
            body_for(
                1,
                medicines=section("recorded", "Coldaway Day Relief"),
                allergies=section("none"),
                conditions=section("none"),
            )
        )
        result = self.check(browser)

        self.assertEqual(result["matches"], [])
        self.assertEqual(result["outcome"], "no_matching_rules")
        self.assertEqual(result["profile_version"], 2)

    def test_the_check_changes_nothing(self):
        browser = self.browser()
        browser.sign_in(PATIENT_B)
        before = self.sql("SELECT version, updated_at FROM health_profiles").all()

        self.check(browser)
        self.check(browser)

        self.assertEqual(self.sql("SELECT version, updated_at FROM health_profiles").all(), before)
