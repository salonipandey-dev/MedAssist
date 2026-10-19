"""Check frontend access through actual HTTP requests and preflight requests."""

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.config import get_cors_origins
from app.main import create_app


class CorsTests(unittest.TestCase):
    def make_client(self, origins=""):
        with patch.dict("os.environ", {"MEDASSIST_CORS_ORIGINS": origins}):
            application = create_app()
        client = TestClient(application)
        client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)
        return client

    def test_cross_origin_access_is_disabled_by_default(self):
        response = self.make_client().get(
            "/health", headers={"Origin": "http://localhost:5173"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("access-control-allow-origin", response.headers)

    def test_only_configured_origins_receive_permission(self):
        client = self.make_client("http://localhost:5173, http://127.0.0.1:5173")
        for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
            with self.subTest(origin=origin):
                response = client.get("/health", headers={"Origin": origin})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["status"], "ok")
                self.assertEqual(response.headers["access-control-allow-origin"], origin)
                self.assertIn("Origin", response.headers["vary"])
                self.assertNotIn("access-control-allow-credentials", response.headers)

        response = client.get("/health", headers={"Origin": "https://unlisted.example"})
        self.assertNotIn("access-control-allow-origin", response.headers)

    def test_preflight_allows_get_and_head_from_a_configured_origin(self):
        client = self.make_client("http://localhost:5173")
        for method in ("GET", "HEAD"):
            with self.subTest(method=method):
                response = client.options(
                    "/health",
                    headers={
                        "Origin": "http://localhost:5173",
                        "Access-Control-Request-Method": method,
                    },
                )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.headers["access-control-allow-methods"], "GET, HEAD"
                )
                self.assertEqual(
                    response.headers["access-control-allow-origin"], "http://localhost:5173"
                )

    def test_allowed_frontend_can_check_health_without_a_response_body(self):
        response = self.make_client("http://localhost:5173").head(
            "/health", headers={"Origin": "http://localhost:5173"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(
            response.headers["access-control-allow-origin"], "http://localhost:5173"
        )

    def test_preflight_rejects_unlisted_origins_and_write_methods(self):
        client = self.make_client("http://localhost:5173")
        for origin, method in (
            ("https://unlisted.example", "GET"),
            ("http://localhost:5173", "POST"),
        ):
            with self.subTest(origin=origin, method=method):
                response = client.options(
                    "/health",
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": method,
                    },
                )
                self.assertEqual(response.status_code, 400)
                if origin == "https://unlisted.example":
                    self.assertNotIn("access-control-allow-origin", response.headers)

    def test_factory_instances_keep_independent_configuration(self):
        allowed = self.make_client("http://localhost:5173")
        disabled = self.make_client()
        headers = {"Origin": "http://localhost:5173"}

        self.assertIn("access-control-allow-origin", allowed.get("/", headers=headers).headers)
        self.assertNotIn(
            "access-control-allow-origin", disabled.get("/", headers=headers).headers
        )

    def test_origin_setting_trims_whitespace_and_removes_duplicates(self):
        with patch.dict(
            "os.environ",
            {"MEDASSIST_CORS_ORIGINS": " http://localhost:5173, ,http://localhost:5173 "},
        ):
            self.assertEqual(get_cors_origins(), ["http://localhost:5173"])

    def test_invalid_origin_settings_fail_during_app_creation(self):
        for origin in (
            "*",
            "https://*.example.com",
            "localhost:5173",
            "ftp://localhost:5173",
            "http://localhost:5173/path",
            "http://localhost:5173/",
            "https://example.com?query=1",
            "https://example.com#fragment",
            "https://user:password@example.com",
            "http://localhost:not-a-port",
            "http://localhost:99999",
        ):
            with self.subTest(origin=origin):
                with patch.dict("os.environ", {"MEDASSIST_CORS_ORIGINS": origin}):
                    with self.assertRaisesRegex(ValueError, "MEDASSIST_CORS_ORIGINS"):
                        create_app()
