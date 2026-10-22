"""Exercise request tracing through API routes, errors, and browser access."""

import unittest
from unittest.mock import patch
from uuid import UUID

from fastapi import Request
from fastapi.testclient import TestClient

from app.main import create_app


class RequestIDTests(unittest.TestCase):
    def make_client(self, origins="", application=None, raise_server_exceptions=True):
        if application is None:
            with patch.dict("os.environ", {"MEDASSIST_CORS_ORIGINS": origins}):
                application = create_app()
        client = TestClient(
            application, raise_server_exceptions=raise_server_exceptions
        )
        client.__enter__()
        self.addCleanup(client.__exit__, None, None, None)
        return client

    def assert_request_id(self, response):
        request_id = response.headers["X-Request-ID"]
        parsed = UUID(request_id)
        self.assertEqual(parsed.version, 4)
        self.assertEqual(str(parsed), request_id)
        return request_id

    def test_success_and_handled_errors_have_request_ids(self):
        client = self.make_client()
        for method, path, status in (
            ("GET", "/", 200),
            ("GET", "/health", 200),
            ("HEAD", "/health", 200),
            ("GET", "/missing", 404),
            ("POST", "/health", 405),
        ):
            with self.subTest(method=method, path=path):
                response = client.request(method, path)
                self.assertEqual(response.status_code, status)
                self.assert_request_id(response)

    def test_each_request_receives_a_new_id(self):
        client = self.make_client()
        first = self.assert_request_id(client.get("/health"))
        second = self.assert_request_id(client.get("/health"))

        self.assertNotEqual(first, second)

    def test_unhandled_server_errors_keep_the_route_request_id(self):
        with patch.dict("os.environ", {"MEDASSIST_CORS_ORIGINS": ""}):
            application = create_app()
        route_request_ids = []

        @application.get("/unexpected-error")
        def unexpected_error(request: Request):
            route_request_ids.append(request.state.request_id)
            raise RuntimeError("Internal failure details must stay private")

        client = self.make_client(
            application=application, raise_server_exceptions=False
        )
        response_ids = []
        for _ in range(2):
            response = client.get(
                "/unexpected-error", headers={"X-Request-ID": "caller-chosen-id"}
            )

            self.assertEqual(response.status_code, 500)
            self.assertEqual(response.text, "Internal Server Error")
            response_ids.append(self.assert_request_id(response))
            self.assertEqual(response_ids[-1], route_request_ids[-1])

        self.assertNotEqual(response_ids[0], response_ids[1])

    def test_unhandled_errors_still_propagate_for_debugging(self):
        with patch.dict("os.environ", {"MEDASSIST_CORS_ORIGINS": ""}):
            application = create_app()

        @application.get("/unexpected-error")
        def unexpected_error():
            raise RuntimeError("Unexpected route failure")

        client = self.make_client(application=application)
        with self.assertRaisesRegex(RuntimeError, "Unexpected route failure"):
            client.get("/unexpected-error")

    def test_caller_cannot_choose_the_server_request_id(self):
        supplied_id = "caller-controlled-value"
        response = self.make_client().get(
            "/health", headers={"X-Request-ID": supplied_id}
        )

        self.assertNotEqual(self.assert_request_id(response), supplied_id)

    def test_route_can_read_the_same_id_from_request_state(self):
        with patch.dict("os.environ", {"MEDASSIST_CORS_ORIGINS": ""}):
            application = create_app()

        @application.get("/request-context")
        def request_context(request: Request):
            return {"request_id": request.state.request_id}

        response = self.make_client(application=application).get("/request-context")

        self.assertEqual(response.json()["request_id"], self.assert_request_id(response))

    def test_allowed_frontend_can_read_the_response_id(self):
        client = self.make_client("http://localhost:5173")
        response = client.get("/health", headers={"Origin": "http://localhost:5173"})

        self.assertEqual(response.status_code, 200)
        self.assert_request_id(response)
        self.assertEqual(
            response.headers["access-control-allow-origin"], "http://localhost:5173"
        )
        exposed = {
            header.strip().lower()
            for header in response.headers["access-control-expose-headers"].split(",")
        }
        self.assertIn("x-request-id", exposed)

        preflight = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertEqual(preflight.status_code, 200)
        self.assert_request_id(preflight)
