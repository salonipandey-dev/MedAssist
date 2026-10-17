"""HTTP contract checks; run from backend with unittest discovery."""

import unittest

from fastapi.testclient import TestClient

from app.main import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def test_existing_welcome_response_is_preserved(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(), {"message": "MedAssist backend is running"}
        )

    def test_health_returns_liveness_without_external_dependencies(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "ok", "service": "medassist-api", "version": "0.1.0"},
        )

    def test_health_does_not_accept_write_requests(self):
        response = self.client.post("/health")

        self.assertEqual(response.status_code, 405)

    def test_openapi_documents_the_api_and_health_route(self):
        response = self.client.get("/openapi.json")

        self.assertEqual(response.status_code, 200)
        schema = response.json()
        self.assertEqual(schema["info"]["title"], "MedAssist API")
        self.assertEqual(schema["info"]["version"], "0.1.0")
        self.assertIn("get", schema["paths"]["/health"])

    def test_openapi_defines_required_fields_for_system_responses(self):
        schema = self.client.get("/openapi.json").json()

        for path, fields in (
            ("/", {"message"}),
            ("/health", {"status", "service", "version"}),
        ):
            with self.subTest(path=path):
                response_schema = schema["paths"][path]["get"]["responses"]["200"][
                    "content"
                ]["application/json"]["schema"]
                model_name = response_schema["$ref"].rsplit("/", 1)[-1]
                model = schema["components"]["schemas"][model_name]
                self.assertEqual(set(model["required"]), fields)
                self.assertEqual(set(model["properties"]), fields)


if __name__ == "__main__":
    unittest.main()
