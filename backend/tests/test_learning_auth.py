import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from starlette.requests import Request

from src import auth


def request_with_headers(**headers: str) -> Request:
    raw_headers = [(name.lower().encode(), value.encode()) for name, value in headers.items()]
    return Request({"type": "http", "method": "GET", "path": "/learning/concepts", "headers": raw_headers})


class LearningIdentityTests(unittest.TestCase):
    def test_valid_guest_uuid_becomes_namespaced_learner(self):
        guest_id = str(uuid4())

        learner = auth.get_learner(request_with_headers(**{"X-Guest-Id": guest_id}), settings=object())

        self.assertEqual(learner["learner_id"], f"guest:{guest_id}")
        self.assertEqual(learner["role"], "guest")

    def test_authenticated_user_uses_auth0_subject_as_learner_id(self):
        request = request_with_headers(Authorization="Bearer valid-token")
        authenticated = {"auth0_sub": "auth0|student-1", "email": "student@example.edu", "role": "student"}

        with patch.object(auth, "get_current_user", return_value=authenticated):
            learner = auth.get_learner(request, settings=object())

        self.assertEqual(learner["learner_id"], "auth0|student-1")
        self.assertEqual(learner["role"], "student")

    def test_malformed_guest_id_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            auth.get_learner(request_with_headers(**{"X-Guest-Id": "not-a-uuid"}), settings=object())

        self.assertEqual(raised.exception.status_code, 401)

    def test_missing_identity_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            auth.get_learner(request_with_headers(), settings=object())

        self.assertEqual(raised.exception.status_code, 401)

    def test_guest_chat_consumes_one_quota_slot(self):
        guest_id = str(uuid4())
        request = request_with_headers(**{"X-Guest-Id": guest_id})

        with patch.object(auth, "consume_guest_chat_quota", return_value=1) as consume:
            learner = auth.get_chat_learner(request, settings=object())

        self.assertEqual(learner["learner_id"], f"guest:{guest_id}")
        consume.assert_called_once_with(f"guest:{guest_id}", 10)

    def test_guest_chat_rejects_requests_over_quota(self):
        request = request_with_headers(**{"X-Guest-Id": str(uuid4())})

        with patch.object(auth, "consume_guest_chat_quota", return_value=None):
            with self.assertRaises(HTTPException) as raised:
                auth.get_chat_learner(request, settings=object())

        self.assertEqual(raised.exception.status_code, 429)

    def test_authenticated_chat_does_not_consume_guest_quota(self):
        request = request_with_headers(Authorization="Bearer valid-token")
        authenticated = {"auth0_sub": "auth0|student-1", "email": "student@example.edu", "role": "student"}

        with (
            patch.object(auth, "get_current_user", return_value=authenticated),
            patch.object(auth, "consume_guest_chat_quota") as consume,
        ):
            learner = auth.get_chat_learner(request, settings=object())

        self.assertEqual(learner["learner_id"], "auth0|student-1")
        consume.assert_not_called()


if __name__ == "__main__":
    unittest.main()
