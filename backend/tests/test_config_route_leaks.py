"""Two learner-callable routes must not send internals to the browser.

/backend_connection_configuration is open to any learner, including guests.
On success it returned the Neo4j URI plus database details (vector
dimensions, GDS status, write access). Only the admin app reads those, so
learners now get just the connection flag; staff keep the full payload.

On failure, both it and /get_token_limits returned str(e), which can hold the
URI, the username or a driver's internal hint. Now the full exception goes to
the server log, and the client gets a short generic message in the same
envelope shape it already expects.

No Neo4j or Postgres is used: the step that would touch the database is
patched to return a canned result or raise an exception carrying the kind of
text we must not leak.
"""

import os
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

import score
from src.auth import get_current_user, get_learner

# Not real hosts or passwords; shaped like what a driver error would carry.
FAKE_URI = "neo4j+s://secret-host.databases.neo4j.io"
LEAKY_TEXT = f"Could not connect to {FAKE_URI} as user neo4j_admin: auth failure"
SECRET_MARKERS = ("secret-host", "neo4j+s://", "neo4j_admin")

FAKE_ENV = {
    "NEO4J_URI": FAKE_URI,
    "NEO4J_USERNAME": "neo4j_admin",
    "NEO4J_DATABASE": "neo4j",
    "NEO4J_PASSWORD": "not-a-real-password",
}
# What connection_check_and_get_vector_dimensions returns on a healthy DB.
CONNECTION_CHECK = {
    "db_vector_dimension": 384,
    "application_dimension": 384,
    "message": "Connection Successful",
    "gds_status": False,
    "write_access": True,
}

GUEST = {"learner_id": "guest:abc", "role": "guest", "email": None}
STUDENT = {"learner_id": "local|student-1", "role": "student", "email": "s@example.com"}
ADMIN = {"learner_id": "local|admin-1", "role": "admin", "email": "a@example.com"}


class RouteLeakTestCase(unittest.TestCase):
    def setUp(self):
        self.app = score.app
        self.addCleanup(self.app.dependency_overrides.clear)
        self.client = TestClient(self.app)

    def act_as(self, user):
        self.app.dependency_overrides[get_learner] = lambda: user
        self.app.dependency_overrides[get_current_user] = lambda: user

    def assert_no_secret(self, response):
        for marker in SECRET_MARKERS:
            self.assertNotIn(marker, response.text)


class BackendConnectionConfigurationTests(RouteLeakTestCase):
    def setUp(self):
        super().setUp()
        env = patch.dict(os.environ, FAKE_ENV)
        env.start()
        self.addCleanup(env.stop)
        graph = patch.object(score, "Neo4jGraph", return_value=MagicMock())
        graph.start()
        self.addCleanup(graph.stop)

    def connect(self, check=None):
        check = check or MagicMock(return_value=dict(CONNECTION_CHECK))
        with patch.object(score, "connection_check_and_get_vector_dimensions", check):
            return self.client.post("/backend_connection_configuration")

    def test_learners_never_receive_the_uri(self):
        for learner in (GUEST, STUDENT):
            with self.subTest(role=learner["role"]):
                self.act_as(learner)
                response = self.connect()

                self.assert_no_secret(response)

    def test_learners_get_only_the_connection_flag(self):
        self.act_as(STUDENT)
        body = self.connect().json()

        self.assertEqual(body["status"], "Success")
        self.assertTrue(body["data"]["graph_connection"])
        for field in ("uri", "write_access", "gds_status", "db_vector_dimension"):
            self.assertNotIn(field, body["data"])

    def test_staff_still_get_what_the_admin_app_reads(self):
        # PageLayout.tsx copies these fields into the admin app's credentials.
        self.act_as(ADMIN)
        data = self.connect().json()["data"]

        self.assertEqual(data["uri"], FAKE_URI)
        for field in ("write_access", "gds_status", "gcs_file_cache", "graph_connection"):
            self.assertIn(field, data)

    def test_failure_does_not_leak_to_anyone(self):
        for user in (STUDENT, ADMIN):
            with self.subTest(role=user["role"]):
                self.act_as(user)
                response = self.connect(check=MagicMock(side_effect=RuntimeError(LEAKY_TEXT)))

                self.assert_no_secret(response)
                body = response.json()
                self.assertEqual(body["status"], "Failed")
                # PageLayout.tsx shows data.error, so it must still be set.
                self.assertTrue(body["error"])
                self.assertIs(body["data"], False)

    def test_failure_is_still_logged_on_the_server(self):
        self.act_as(STUDENT)
        with self.assertLogs(level="ERROR") as logs:
            self.connect(check=MagicMock(side_effect=RuntimeError(LEAKY_TEXT)))

        self.assertIn("secret-host", "\n".join(logs.output))


class GetTokenLimitsTests(RouteLeakTestCase):
    def setUp(self):
        super().setUp()
        env = patch.dict(os.environ, {"TRACK_TOKEN_USAGE": "true"})
        env.start()
        self.addCleanup(env.stop)

    def fetch(self, limits):
        with patch.object(score, "get_remaining_token_limits", limits):
            return self.client.post("/get_token_limits", data={"email": "s@example.com"})

    def test_failure_does_not_leak_to_anyone(self):
        for user in (STUDENT, ADMIN):
            with self.subTest(role=user["role"]):
                self.act_as(user)
                response = self.fetch(MagicMock(side_effect=RuntimeError(LEAKY_TEXT)))

                self.assert_no_secret(response)
                body = response.json()
                # TokenLimits.ts only returns data on status Success.
                self.assertEqual(body["status"], "Failed")
                self.assertTrue(body["error"])

    def test_failure_is_still_logged_on_the_server(self):
        self.act_as(STUDENT)
        with self.assertLogs(level="ERROR") as logs:
            self.fetch(MagicMock(side_effect=RuntimeError(LEAKY_TEXT)))

        self.assertIn("secret-host", "\n".join(logs.output))

    def test_success_still_returns_the_limits(self):
        limits = {"daily_remaining": 5, "monthly_remaining": 9}
        self.act_as(STUDENT)
        body = self.fetch(MagicMock(return_value=limits)).json()

        self.assertEqual(body["status"], "Success")
        self.assertEqual(body["data"], limits)


if __name__ == "__main__":
    unittest.main()
