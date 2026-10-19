"""The local-dev login shortcut (src/dev_auth.py).

In local development, a person or a Playwright test can send an `X-Dev-User: student`
(or `ta` / `admin`) header instead of an Auth0 token. That must only ever work when
BOTH of these are set:

    DEV_AUTH_BYPASS=true
    APP_ENV=development

Anything else -- either variable missing, misspelled, or set to another value -- must
behave exactly like production: the header is rejected with 401. These tests pin that
"fail closed" behaviour, because a bypass that switches on by accident is a full
authentication bypass.

No real database is touched: `set_user_role` (the app_users upsert) is patched out.
"""

import os
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

import score
from src import auth, dev_auth
from src.local_auth import store as local_auth_store

ENABLED_ENV = {"DEV_AUTH_BYPASS": "true", "APP_ENV": "development"}
DEV_ENV_KEYS = ("DEV_AUTH_BYPASS", "APP_ENV")


def env_without_dev_flags(**overrides: str) -> dict:
    """A copy of the real environment with both dev flags removed, plus overrides.

    Removing them first matters: if the developer's own shell (or the container)
    happens to have DEV_AUTH_BYPASS set, a "disabled by default" test must still
    see it as unset.
    """
    env = {key: value for key, value in os.environ.items() if key not in DEV_ENV_KEYS}
    env.update(overrides)
    return env


def request_with_headers(**headers: str) -> Request:
    raw_headers = [(name.lower().encode(), value.encode()) for name, value in headers.items()]
    return Request({"type": "http", "method": "GET", "path": "/learning/concepts", "headers": raw_headers})


def fake_set_user_role(auth0_sub, email, role):
    """Stands in for the app_users upsert; returns the role it was asked to store."""
    return role


class DevAuthHttpTests(unittest.TestCase):
    def setUp(self):
        self.app = score.app
        self.addCleanup(self.app.dependency_overrides.clear)
        self.client = TestClient(self.app)

        upsert_patch = patch.object(dev_auth, "set_user_role", side_effect=fake_set_user_role)
        self.upsert = upsert_patch.start()
        self.addCleanup(upsert_patch.stop)

    def login_as(self, role: str):
        # GET /auth/me answers "who am I?", so it shows which identity dev login gave us.
        return self.client.get("/auth/me", headers={"X-Dev-User": role})

    def use_env(self, **env: str):
        env_patch = patch.dict(os.environ, env_without_dev_flags(**env), clear=True)
        env_patch.start()
        self.addCleanup(env_patch.stop)

    # --- disabled ---------------------------------------------------------------

    def test_disabled_by_default_rejects_dev_header(self):
        self.use_env()

        response = self.login_as("admin")

        self.assertEqual(response.status_code, 401)
        self.upsert.assert_not_called()

    def test_flag_without_development_env_is_still_disabled(self):
        self.use_env(DEV_AUTH_BYPASS="true", APP_ENV="production")

        response = self.login_as("admin")

        self.assertEqual(response.status_code, 401)
        self.upsert.assert_not_called()

    def test_flag_with_app_env_missing_is_still_disabled(self):
        self.use_env(DEV_AUTH_BYPASS="true")

        self.assertEqual(self.login_as("admin").status_code, 401)

    def test_development_env_without_flag_is_still_disabled(self):
        self.use_env(APP_ENV="development")

        self.assertEqual(self.login_as("admin").status_code, 401)

    def test_flag_must_be_exactly_true(self):
        # "1", "yes", "on" are not accepted: one spelling, so it is easy to grep for.
        for value in ("1", "yes", "on", "truee", ""):
            with self.subTest(value=value):
                self.use_env(DEV_AUTH_BYPASS=value, APP_ENV="development")
                self.assertEqual(self.login_as("admin").status_code, 401)

    # --- enabled ----------------------------------------------------------------

    def test_enabled_each_role_logs_in_and_is_upserted(self):
        self.use_env(**ENABLED_ENV)

        for role in ("student", "ta", "admin"):
            with self.subTest(role=role):
                response = self.login_as(role)

                self.assertEqual(response.status_code, 200)
                body = response.json()
                self.assertEqual(body["role"], role)
                self.upsert.assert_called_with(f"dev|{role}", f"{role}@dev.cora.local", role)

    def test_enabled_unknown_role_is_rejected(self):
        self.use_env(**ENABLED_ENV)

        for role in ("superuser", "test_full", "ADMIN ", "admin;drop"):
            with self.subTest(role=role):
                self.assertEqual(self.login_as(role).status_code, 401)

    def test_enabled_roles_are_enforced_by_require_role(self):
        # GET /admin/users is admin-only. Dev students and TAs must still be refused.
        self.use_env(**ENABLED_ENV)

        with patch.object(local_auth_store, "list_users", return_value=[]):
            student = self.client.get("/admin/users", headers={"X-Dev-User": "student"})
            ta = self.client.get("/admin/users", headers={"X-Dev-User": "ta"})
            admin = self.client.get("/admin/users", headers={"X-Dev-User": "admin"})

        self.assertEqual(student.status_code, 403)
        self.assertEqual(ta.status_code, 403)
        self.assertEqual(admin.status_code, 200)


class DevAuthLearnerTests(unittest.TestCase):
    """get_learner powers every student endpoint (guest or signed in)."""

    def setUp(self):
        upsert_patch = patch.object(dev_auth, "set_user_role", side_effect=fake_set_user_role)
        upsert_patch.start()
        self.addCleanup(upsert_patch.stop)

    def test_enabled_dev_user_becomes_learner(self):
        with patch.dict(os.environ, env_without_dev_flags(**ENABLED_ENV), clear=True):
            learner = auth.get_learner(request_with_headers(**{"X-Dev-User": "student"}))

        self.assertEqual(learner["learner_id"], "dev|student")
        self.assertEqual(learner["role"], "student")

    def test_disabled_dev_header_is_not_silently_downgraded_to_guest(self):
        # Fail closed: a dev header the server will not honour is an error, even if
        # a valid guest id rides along. Otherwise a misconfigured demo would look
        # "logged in" while actually being a guest.
        headers = {"X-Dev-User": "admin", "X-Guest-Id": str(uuid4())}
        with patch.dict(os.environ, env_without_dev_flags(), clear=True):
            with self.assertRaises(HTTPException) as raised:
                auth.get_learner(request_with_headers(**headers))

        self.assertEqual(raised.exception.status_code, 401)


class DevAuthStartupTests(unittest.TestCase):
    def test_startup_warns_loudly_when_enabled(self):
        with patch.dict(os.environ, env_without_dev_flags(**ENABLED_ENV), clear=True):
            with self.assertLogs(dev_auth.logger, level="WARNING") as logs:
                dev_auth.log_startup_status()

        self.assertTrue(any("DEV_AUTH_BYPASS" in line for line in logs.output))

    def test_startup_flags_ignored_bypass_outside_development(self):
        with patch.dict(os.environ, env_without_dev_flags(DEV_AUTH_BYPASS="true", APP_ENV="production"), clear=True):
            with self.assertLogs(dev_auth.logger, level="ERROR") as logs:
                dev_auth.log_startup_status()

        self.assertTrue(any("ignored" in line.lower() for line in logs.output))


if __name__ == "__main__":
    unittest.main()
