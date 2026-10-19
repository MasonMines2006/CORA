"""Chat errors must never send raw exception text to the browser.

When the OpenAI key was rejected, /chat_bot answered HTTP 200 with
data.info.error holding OpenAI's own error string. That string contains a
masked copy of the API key (its last four characters show) and internal hints
such as "Please drop and create a new vector index". The browser only checks
whether info.error is set, so it never needed that text.

Now the full exception goes to the server log, and the client gets a short
generic message in the same envelope shape it already expects.

No Neo4j, Postgres or LLM is used: the step that would call OpenAI is patched
to raise an exception carrying the kind of text we must not leak.
"""

import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

import score
from src import QA_integration
from src.auth import get_chat_learner, get_learner
from src.entities.user_credential import get_server_neo4j_credentials

# Shaped like the real OpenAI 401 text; not a real key.
LEAKY_TEXT = (
    "Error code: 401 - Incorrect API key provided: sk-proj-****************wxyz. "
    "Please drop and create a new vector index"
)
SECRET_MARKERS = ("sk-proj-", "wxyz", "drop and create")

STUDENT = {"learner_id": "local|student-1", "role": "student"}
ADMIN = {"learner_id": "local|admin-1", "role": "admin"}


class ChatErrorLeakTests(unittest.TestCase):
    def setUp(self):
        self.app = score.app
        self.addCleanup(self.app.dependency_overrides.clear)
        self.app.dependency_overrides[get_server_neo4j_credentials] = lambda: MagicMock()
        self.client = TestClient(self.app)

        access = MagicMock()
        access.return_value.check_account_access.return_value = False
        history = MagicMock()
        history.messages = []
        patches = [
            patch.object(score, "create_graph_database_connection", return_value=MagicMock()),
            patch.object(score, "graphDBdataAccess", access),
            patch.object(score, "publication_fingerprint", return_value="rev1"),
            patch.object(QA_integration, "create_neo4j_chat_message_history", return_value=history),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def act_as(self, learner):
        self.app.dependency_overrides[get_chat_learner] = lambda: learner
        self.app.dependency_overrides[get_learner] = lambda: learner

    def ask(self, mode="vector"):
        return self.client.post(
            "/chat_bot",
            data={"question": "What is a reactor?", "session_id": "s1", "mode": mode, "document_names": "[]"},
        )

    def assert_no_secret(self, response):
        for marker in SECRET_MARKERS:
            self.assertNotIn(marker, response.text)

    def test_student_never_sees_the_openai_error_text(self):
        self.act_as(STUDENT)
        with patch.object(QA_integration, "setup_chat", side_effect=RuntimeError(LEAKY_TEXT)):
            response = self.ask()

        self.assert_no_secret(response)

    def test_error_keeps_the_envelope_the_frontend_classifies(self):
        # askModel.ts treats a truthy data.info.error as "Couldn't get an answer."
        self.act_as(STUDENT)
        with patch.object(QA_integration, "setup_chat", side_effect=RuntimeError(LEAKY_TEXT)):
            body = self.ask().json()

        self.assertEqual(body["status"], "Success")
        self.assertIsInstance(body["data"]["message"], str)
        self.assertTrue(body["data"]["info"]["error"])

    def test_full_exception_is_still_logged_on_the_server(self):
        self.act_as(STUDENT)
        with patch.object(QA_integration, "setup_chat", side_effect=RuntimeError(LEAKY_TEXT)):
            with self.assertLogs(level="ERROR") as logs:
                self.ask()

        self.assertIn("sk-proj-", "\n".join(logs.output))

    def test_admin_does_not_get_the_raw_text_either(self):
        # Staff read the server log; the browser is still a client.
        self.act_as(ADMIN)
        with patch.object(QA_integration, "setup_chat", side_effect=RuntimeError(LEAKY_TEXT)):
            response = self.ask()

        self.assert_no_secret(response)

    def test_graph_mode_error_does_not_leak(self):
        self.act_as(ADMIN)
        with patch.object(score, "Neo4jGraph", return_value=MagicMock()), \
                patch.object(QA_integration, "create_graph_chain", side_effect=RuntimeError(LEAKY_TEXT)):
            response = self.ask(mode="graph")

        self.assert_no_secret(response)
        self.assertTrue(response.json()["data"]["info"]["error"])

    def test_failure_outside_the_chat_helper_does_not_leak(self):
        # The route's own except: QA_RAG itself blows up before any helper runs.
        for learner in (STUDENT, ADMIN):
            with self.subTest(role=learner["role"]):
                self.act_as(learner)
                with patch.object(score, "QA_RAG", side_effect=RuntimeError(LEAKY_TEXT)):
                    response = self.ask()

                self.assert_no_secret(response)
                self.assertEqual(response.json()["status"], "Failed")
                self.assertTrue(response.json()["error"])

    def test_clear_chat_failure_does_not_leak(self):
        self.act_as(STUDENT)
        with patch.object(score, "clear_chat_history", side_effect=RuntimeError(LEAKY_TEXT)):
            response = self.client.post("/clear_chat_bot", data={"session_id": "s1"})

        self.assert_no_secret(response)
        self.assertEqual(response.json()["status"], "Failed")


if __name__ == "__main__":
    unittest.main()
