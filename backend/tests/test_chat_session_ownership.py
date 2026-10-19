"""Chat sessions belong to the learner who created them.

The client picks a chat session id and sends it with every question (and with
"clear chat"). Before this, the server stored history under that id as-is, so
anyone who learned another person's session id could read that conversation
back through the LLM's memory, or wipe it.

Now the server always derives the storage key from the *verified* learner id
(Auth0 subject, dev login, or guest UUID) plus the client's id. Two learners who
send the same session id get two different histories, and "clear" can only ever
reach the caller's own history.

No Neo4j, Postgres or LLM is used: QA_RAG and clear_chat_history are patched and
we only look at which session key they were handed.
"""

import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

import score
from src.auth import get_chat_learner, get_learner
from src.chat_sessions import owned_session_id
from src.entities.user_credential import get_server_neo4j_credentials

ALICE = {"learner_id": "guest:11111111-1111-4111-8111-111111111111", "role": "guest"}
BOB = {"learner_id": "guest:22222222-2222-4222-8222-222222222222", "role": "guest"}
ADMIN = {"learner_id": "auth0|admin-1", "auth0_sub": "auth0|admin-1", "role": "admin"}
SHARED_CLIENT_ID = "same-session-id-from-the-browser"
FINGERPRINT = "rev42"


class OwnedSessionIdTests(unittest.TestCase):
    def test_same_learner_and_id_gives_same_key(self):
        self.assertEqual(
            owned_session_id(ALICE["learner_id"], SHARED_CLIENT_ID),
            owned_session_id(ALICE["learner_id"], SHARED_CLIENT_ID),
        )

    def test_different_learners_with_same_id_get_different_keys(self):
        self.assertNotEqual(
            owned_session_id(ALICE["learner_id"], SHARED_CLIENT_ID),
            owned_session_id(BOB["learner_id"], SHARED_CLIENT_ID),
        )

    def test_client_cannot_forge_another_learners_key(self):
        # Bob sends Alice's full server-side key as his "session id". He must still
        # land in his own namespace, not hers.
        alice_key = owned_session_id(ALICE["learner_id"], SHARED_CLIENT_ID)

        self.assertNotEqual(owned_session_id(BOB["learner_id"], alice_key), alice_key)

    def test_key_does_not_expose_the_raw_learner_id(self):
        # Session nodes are visible in the admin graph tools; keep identities out of them.
        key = owned_session_id(ADMIN["learner_id"], SHARED_CLIENT_ID)

        self.assertNotIn("auth0|admin-1", key)

    def test_missing_learner_id_is_refused(self):
        with self.assertRaises(ValueError):
            owned_session_id("", SHARED_CLIENT_ID)


class ChatRouteOwnershipTests(unittest.TestCase):
    def setUp(self):
        self.app = score.app
        self.addCleanup(self.app.dependency_overrides.clear)
        self.app.dependency_overrides[get_server_neo4j_credentials] = lambda: MagicMock()
        self.client = TestClient(self.app)

        self.qa_rag = MagicMock(side_effect=lambda **kwargs: {
            "session_id": kwargs["session_id"], "message": "ok", "info": {},
        })
        self.clear = MagicMock(side_effect=lambda graph, session_id: {"session_id": session_id})
        access = MagicMock()
        access.return_value.check_account_access.return_value = False
        patches = [
            patch.object(score, "QA_RAG", self.qa_rag),
            patch.object(score, "clear_chat_history", self.clear),
            patch.object(score, "create_graph_database_connection", return_value=MagicMock()),
            patch.object(score, "graphDBdataAccess", access),
            patch.object(score, "publication_fingerprint", return_value=FINGERPRINT),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def act_as(self, learner):
        self.app.dependency_overrides[get_chat_learner] = lambda: learner
        self.app.dependency_overrides[get_learner] = lambda: learner

    def ask(self, session_id=SHARED_CLIENT_ID):
        return self.client.post("/chat_bot", data={"question": "What is a reactor?", "session_id": session_id, "mode": "vector"})

    def stored_key_of_last_question(self):
        return self.qa_rag.call_args.kwargs["session_id"]

    def test_two_learners_with_the_same_session_id_get_separate_histories(self):
        self.act_as(ALICE)
        self.ask()
        alice_key = self.stored_key_of_last_question()

        self.act_as(BOB)
        self.ask()
        bob_key = self.stored_key_of_last_question()

        self.assertNotEqual(alice_key, bob_key)

    def test_response_returns_the_client_session_id_not_the_storage_key(self):
        self.act_as(ALICE)

        body = self.ask().json()

        self.assertEqual(body["data"]["session_id"], SHARED_CLIENT_ID)

    def test_learner_clear_reaches_exactly_the_history_their_chat_wrote(self):
        # Regression: chat stored learner history under "<id>:pub:<fingerprint>"
        # but clear wiped "<id>", so Clear chat never cleared anything.
        self.act_as(ALICE)
        self.ask()
        written_key = self.stored_key_of_last_question()

        self.client.post("/clear_chat_bot", data={"session_id": SHARED_CLIENT_ID})

        self.assertEqual(self.clear.call_args.kwargs["session_id"], written_key)

    def test_one_learner_cannot_clear_another_learners_history(self):
        self.act_as(ALICE)
        self.ask()
        alice_key = self.stored_key_of_last_question()

        self.act_as(BOB)
        self.client.post("/clear_chat_bot", data={"session_id": SHARED_CLIENT_ID})

        self.assertNotEqual(self.clear.call_args.kwargs["session_id"], alice_key)

    def test_admin_sessions_are_owned_too(self):
        self.act_as(ADMIN)
        self.ask()
        admin_key = self.stored_key_of_last_question()

        self.act_as(ALICE)
        self.ask()

        self.assertNotEqual(admin_key, self.stored_key_of_last_question())

    def test_clear_without_session_id_is_rejected(self):
        self.act_as(ALICE)

        body = self.client.post("/clear_chat_bot", data={}).json()

        self.assertEqual(body["status"], "Failed")
        self.clear.assert_not_called()


if __name__ == "__main__":
    unittest.main()
