"""CORA's own sign-in, end to end: real routes, real Postgres, no Auth0.

What Mason decided (Obsidian handoff, section 3) and what these tests pin:

- Email + password. CORA issues its own session token; roles live in app_users.
- Sign-up is invite-only by default. An admin creates single-use invite links
  (the allowlist). An admin "Open enrollment" switch lets anyone register as a
  student while it is on; accounts made then keep working after it is turned off.
- No email service: an admin issues a one-time password-reset link and sends it.
- Errors never reveal whether an email has an account. 5 wrong passwords lock
  the account for 15 minutes.
- Changing or resetting a password, or deactivating an account, signs that
  person out everywhere (old tokens stop working).

Every row is written under a unique test email and deleted afterwards. Skips
cleanly when no Postgres is configured.
"""

import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.local_auth import passwords, router as router_module, store
from src.local_auth.rate_limit import SlidingWindowLimiter
from src.local_auth.router import admin_router, router as auth_router
from src.user_store import get_pool

GENERIC_LOGIN_ERROR = "Email or password is incorrect"
GOOD_PASSWORD = "decay heat never stops"
OTHER_PASSWORD = "xenon builds after a scram"
TEST_DOMAIN = "test.cora.local"


def _postgres_available() -> bool:
    if not os.environ.get("POSTGRES_USER"):
        return False
    try:
        with get_pool().connection() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


class LocalAuthApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not _postgres_available():
            raise unittest.SkipTest("No reachable Postgres; skipping auth API checks")
        store.ensure_auth_tables()
        app = FastAPI()
        app.include_router(auth_router)
        app.include_router(admin_router)
        cls.client = TestClient(app)

    def setUp(self):
        env = patch.dict(os.environ, {"CORA_JWT_SECRET": "s" * 48})
        env.start()
        self.addCleanup(env.stop)
        # Every TestClient request comes from the same address, so give each
        # test a fresh per-address budget.
        router_module._login_limiter.reset()
        router_module._signup_limiter.reset()
        router_module._link_limiter.reset()
        # Each test gets its own email namespace, so tests never see each other's rows.
        self.run_id = uuid4().hex[:10]
        self.addCleanup(self._delete_test_rows)
        self._enrollment_before = store.get_open_enrollment()
        self.addCleanup(store.set_open_enrollment, self._enrollment_before)
        store.set_open_enrollment(False)
        self.admin = self.make_user("admin", role="admin")
        self.admin_token = self.login(self.admin["email"], GOOD_PASSWORD).json()["token"]

    def _delete_test_rows(self):
        pattern = f"%-{self.run_id}@{TEST_DOMAIN}"
        with get_pool().connection() as conn:
            conn.execute("DELETE FROM auth_links WHERE email LIKE %s", (pattern,))
            conn.execute("DELETE FROM app_users WHERE email LIKE %s", (pattern,))
            conn.commit()

    # --- helpers -------------------------------------------------------------

    def email(self, name: str) -> str:
        return f"{name}-{self.run_id}@{TEST_DOMAIN}"

    def make_user(self, name: str, role: str = "student", password: str = GOOD_PASSWORD) -> dict:
        return store.create_user(self.email(name), name.title(), passwords.hash_password(password), role)

    def login(self, email: str, password: str, keep: bool = False):
        return self.client.post("/auth/login", json={"email": email, "password": password, "keep_signed_in": keep})

    def me(self, token: str):
        return self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    def as_admin(self) -> dict:
        return {"Authorization": f"Bearer {self.admin_token}"}

    def bearer(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}


class LoginTests(LocalAuthApiTestCase):
    def test_right_password_signs_in_and_the_token_works(self):
        self.make_user("ada")

        response = self.login(self.email("ada"), GOOD_PASSWORD)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["user"]["email"], self.email("ada"))
        self.assertEqual(body["user"]["role"], "student")
        self.assertEqual(self.me(body["token"]).json()["email"], self.email("ada"))

    def test_email_is_not_case_sensitive(self):
        self.make_user("ada")

        response = self.login(self.email("ada").upper(), GOOD_PASSWORD)

        self.assertEqual(response.status_code, 200)

    def test_wrong_password_and_unknown_email_get_the_same_answer(self):
        self.make_user("ada")

        wrong_password = self.login(self.email("ada"), OTHER_PASSWORD)
        unknown_email = self.login(self.email("nobody"), OTHER_PASSWORD)

        self.assertEqual(wrong_password.status_code, 401)
        self.assertEqual(unknown_email.status_code, 401)
        self.assertEqual(wrong_password.json(), unknown_email.json())
        self.assertEqual(wrong_password.json()["detail"], GENERIC_LOGIN_ERROR)

    def test_five_wrong_passwords_lock_the_account_even_for_the_right_one(self):
        self.make_user("ada")
        for _ in range(5):
            self.login(self.email("ada"), OTHER_PASSWORD)

        response = self.login(self.email("ada"), GOOD_PASSWORD)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], GENERIC_LOGIN_ERROR)

    def test_a_good_login_clears_earlier_failures(self):
        self.make_user("ada")
        for _ in range(4):
            self.login(self.email("ada"), OTHER_PASSWORD)
        self.login(self.email("ada"), GOOD_PASSWORD)
        for _ in range(4):
            self.login(self.email("ada"), OTHER_PASSWORD)

        self.assertEqual(self.login(self.email("ada"), GOOD_PASSWORD).status_code, 200)

    def test_keep_signed_in_issues_a_longer_session(self):
        self.make_user("ada")

        short = self.login(self.email("ada"), GOOD_PASSWORD).json()["expires_at"]
        long = self.login(self.email("ada"), GOOD_PASSWORD, keep=True).json()["expires_at"]

        self.assertGreater(datetime.fromisoformat(long), datetime.fromisoformat(short) + timedelta(days=1))

    def test_one_address_trying_too_many_logins_is_slowed_down(self):
        # A tiny budget keeps the test fast; the real one is in router.py.
        with patch.object(router_module, "_login_limiter", SlidingWindowLimiter(max_events=3, window_seconds=60)):
            responses = [self.login(self.email(f"guess{n}"), OTHER_PASSWORD) for n in range(4)]

        self.assertEqual(responses[-1].status_code, 429)

    def test_no_token_and_bad_token_are_refused(self):
        self.assertEqual(self.client.get("/auth/me").status_code, 401)
        self.assertEqual(self.me("not-a-token").status_code, 401)


class AuthConfigTests(LocalAuthApiTestCase):
    def test_config_tells_the_sign_in_page_what_to_show(self):
        body = self.client.get("/auth/config").json()

        self.assertEqual(body, {"open_enrollment": False, "sso_enabled": False})


class OpenEnrollmentTests(LocalAuthApiTestCase):
    def register(self, name: str, password: str = GOOD_PASSWORD, **extra):
        return self.client.post(
            "/auth/register", json={"email": self.email(name), "name": name.title(), "password": password, **extra}
        )

    def test_registration_is_closed_by_default(self):
        response = self.register("bo")

        self.assertEqual(response.status_code, 403)

    def test_admin_can_open_enrollment_and_anyone_can_then_join_as_a_student(self):
        toggle = self.client.put("/admin/settings/enrollment", json={"open_enrollment": True}, headers=self.as_admin())
        self.assertEqual(toggle.status_code, 200)

        response = self.register("bo", role="admin")  # trying to sneak a role in is ignored

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["role"], "student")

    def test_accounts_made_during_open_enrollment_survive_it_closing(self):
        store.set_open_enrollment(True)
        self.register("bo")
        store.set_open_enrollment(False)

        self.assertEqual(self.login(self.email("bo"), GOOD_PASSWORD).status_code, 200)

    def test_weak_password_is_refused_with_the_rules(self):
        store.set_open_enrollment(True)

        response = self.register("bo", password="short")

        self.assertEqual(response.status_code, 422)
        self.assertIn("Use at least 12 characters.", response.json()["detail"]["problems"])

    def test_cannot_register_an_email_that_already_has_an_account(self):
        store.set_open_enrollment(True)
        self.make_user("bo")

        response = self.register("bo", password=OTHER_PASSWORD)

        self.assertEqual(response.status_code, 409)
        # The existing account's password is untouched.
        self.assertEqual(self.login(self.email("bo"), GOOD_PASSWORD).status_code, 200)

    def test_students_cannot_toggle_enrollment(self):
        self.make_user("ada")
        token = self.login(self.email("ada"), GOOD_PASSWORD).json()["token"]

        response = self.client.put("/admin/settings/enrollment", json={"open_enrollment": True}, headers=self.bearer(token))

        self.assertEqual(response.status_code, 403)


class InviteTests(LocalAuthApiTestCase):
    def invite(self, names, role="student", headers=None):
        return self.client.post(
            "/admin/invites",
            json={"emails": [self.email(name) for name in names], "role": role},
            headers=headers or self.as_admin(),
        )

    def test_admin_invite_link_lets_that_person_set_a_password_and_sign_in(self):
        created = self.invite(["cy"], role="ta").json()["invites"]
        token = created[0]["token"]

        preview = self.client.get(f"/auth/invites/{token}")
        accepted = self.client.post(f"/auth/invites/{token}/accept", json={"name": "Cy", "password": GOOD_PASSWORD})

        self.assertEqual(preview.json()["email"], self.email("cy"))
        self.assertEqual(preview.json()["role"], "ta")
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(self.me(accepted.json()["token"]).json()["role"], "ta")

    def test_invite_links_work_once(self):
        token = self.invite(["cy"]).json()["invites"][0]["token"]
        self.client.post(f"/auth/invites/{token}/accept", json={"name": "Cy", "password": GOOD_PASSWORD})

        again = self.client.post(f"/auth/invites/{token}/accept", json={"name": "Cy", "password": OTHER_PASSWORD})

        self.assertEqual(again.status_code, 404)
        self.assertEqual(self.client.get(f"/auth/invites/{token}").status_code, 404)

    def test_expired_invite_is_refused(self):
        raw = store.create_link("invite", self.email("cy"), "student", None, self.admin["subject"], ttl=timedelta(seconds=-1))

        self.assertEqual(self.client.get(f"/auth/invites/{raw}").status_code, 404)

    def test_made_up_invite_is_refused(self):
        self.assertEqual(self.client.get("/auth/invites/not-a-real-token").status_code, 404)

    def test_inviting_someone_who_already_has_an_account_is_skipped(self):
        self.make_user("cy")

        body = self.invite(["cy", "dee"]).json()

        self.assertEqual([invite["email"] for invite in body["invites"]], [self.email("dee")])
        self.assertEqual(body["skipped"], [self.email("cy")])

    def test_students_cannot_create_invites(self):
        self.make_user("ada")
        token = self.login(self.email("ada"), GOOD_PASSWORD).json()["token"]

        response = self.invite(["cy"], headers=self.bearer(token))

        self.assertEqual(response.status_code, 403)

    def test_unknown_role_is_refused(self):
        self.assertEqual(self.invite(["cy"], role="superuser").status_code, 422)


class PasswordResetTests(LocalAuthApiTestCase):
    def issue_reset(self, user_id):
        return self.client.post(f"/admin/users/{user_id}/reset-link", headers=self.as_admin())

    def test_admin_reset_link_sets_a_new_password_and_signs_out_old_sessions(self):
        user = self.make_user("ada")
        old_token = self.login(self.email("ada"), GOOD_PASSWORD).json()["token"]
        link = self.issue_reset(user["id"]).json()["token"]

        preview = self.client.get(f"/auth/reset/{link}")
        done = self.client.post(f"/auth/reset/{link}", json={"password": OTHER_PASSWORD})

        self.assertEqual(preview.json()["email"], self.email("ada"))
        self.assertEqual(done.status_code, 204)
        self.assertEqual(self.login(self.email("ada"), GOOD_PASSWORD).status_code, 401)
        self.assertEqual(self.login(self.email("ada"), OTHER_PASSWORD).status_code, 200)
        self.assertEqual(self.me(old_token).status_code, 401)

    def test_reset_links_work_once(self):
        user = self.make_user("ada")
        link = self.issue_reset(user["id"]).json()["token"]
        self.client.post(f"/auth/reset/{link}", json={"password": OTHER_PASSWORD})

        again = self.client.post(f"/auth/reset/{link}", json={"password": "a third long password"})

        self.assertEqual(again.status_code, 404)

    def test_reset_unlocks_a_locked_account(self):
        user = self.make_user("ada")
        for _ in range(5):
            self.login(self.email("ada"), OTHER_PASSWORD)
        link = self.issue_reset(user["id"]).json()["token"]

        self.client.post(f"/auth/reset/{link}", json={"password": OTHER_PASSWORD})

        self.assertEqual(self.login(self.email("ada"), OTHER_PASSWORD).status_code, 200)

    def test_reset_still_enforces_password_rules(self):
        user = self.make_user("ada")
        link = self.issue_reset(user["id"]).json()["token"]

        response = self.client.post(f"/auth/reset/{link}", json={"password": "short"})

        self.assertEqual(response.status_code, 422)


class ChangePasswordTests(LocalAuthApiTestCase):
    def test_change_password_needs_the_current_one_and_rotates_the_session(self):
        self.make_user("ada")
        token = self.login(self.email("ada"), GOOD_PASSWORD).json()["token"]

        wrong = self.client.post(
            "/auth/password", json={"current_password": OTHER_PASSWORD, "new_password": OTHER_PASSWORD}, headers=self.bearer(token)
        )
        right = self.client.post(
            "/auth/password", json={"current_password": GOOD_PASSWORD, "new_password": OTHER_PASSWORD}, headers=self.bearer(token)
        )

        self.assertEqual(wrong.status_code, 400)
        self.assertEqual(right.status_code, 200)
        self.assertEqual(self.me(token).status_code, 401)  # old session is gone
        self.assertEqual(self.me(right.json()["token"]).status_code, 200)  # the new one works


class SecurityReviewFollowUpTests(LocalAuthApiTestCase):
    """Fixes from the security review of this branch."""

    def change(self, token, current):
        return self.client.post(
            "/auth/password", json={"current_password": current, "new_password": OTHER_PASSWORD}, headers=self.bearer(token)
        )

    def test_guessing_the_current_password_counts_toward_the_lockout(self):
        # A stolen session token must not allow unlimited guesses at the password.
        self.make_user("ada")
        token = self.login(self.email("ada"), GOOD_PASSWORD).json()["token"]
        for _ in range(5):
            self.change(token, "wrong guess number x")

        self.assertEqual(self.change(token, GOOD_PASSWORD).status_code, 400)
        self.assertEqual(self.login(self.email("ada"), GOOD_PASSWORD).status_code, 401)

    def test_a_new_reset_link_cancels_older_ones(self):
        user = self.make_user("ada")
        first = self.client.post(f"/admin/users/{user['id']}/reset-link", headers=self.as_admin()).json()["token"]
        self.client.post(f"/admin/users/{user['id']}/reset-link", headers=self.as_admin())

        self.assertEqual(self.client.get(f"/auth/reset/{first}").status_code, 404)

    def test_a_class_accepting_invites_from_one_network_is_not_throttled(self):
        # Students on one campus network share an address; 60 of them joining
        # in an hour must all get through.
        links = self.client.post(
            "/admin/invites", json={"emails": [self.email(f"s{n}") for n in range(60)], "role": "student"}, headers=self.as_admin()
        ).json()["invites"]

        codes = {
            self.client.post(f"/auth/invites/{link['token']}/accept", json={"name": "S", "password": GOOD_PASSWORD}).status_code
            for link in links
        }

        self.assertEqual(codes, {200})

    def test_login_refuses_absurdly_long_passwords_before_hashing(self):
        response = self.login(self.email("ada"), "x" * 129)

        self.assertEqual(response.status_code, 422)


class AdminUserTests(LocalAuthApiTestCase):
    def test_admin_sees_users_with_role_and_status(self):
        self.make_user("ada")

        users = self.client.get("/admin/users", headers=self.as_admin()).json()["users"]
        ada = next(user for user in users if user["email"] == self.email("ada"))

        self.assertEqual((ada["role"], ada["status"]), ("student", "active"))

    def test_pending_invites_are_listed_too(self):
        self.client.post("/admin/invites", json={"emails": [self.email("cy")], "role": "student"}, headers=self.as_admin())

        invites = self.client.get("/admin/invites", headers=self.as_admin()).json()["invites"]

        self.assertIn(self.email("cy"), [invite["email"] for invite in invites])

    def test_admin_can_change_a_role(self):
        user = self.make_user("ada")

        response = self.client.patch(f"/admin/users/{user['id']}", json={"role": "ta"}, headers=self.as_admin())

        self.assertEqual(response.json()["role"], "ta")

    def test_admin_cannot_change_their_own_role_or_deactivate_themselves(self):
        own_role = self.client.patch(f"/admin/users/{self.admin['id']}", json={"role": "student"}, headers=self.as_admin())
        own_active = self.client.patch(f"/admin/users/{self.admin['id']}", json={"is_active": False}, headers=self.as_admin())

        self.assertEqual(own_role.status_code, 400)
        self.assertEqual(own_active.status_code, 400)

    def test_deactivating_signs_someone_out_and_blocks_login_until_reactivated(self):
        user = self.make_user("ada")
        token = self.login(self.email("ada"), GOOD_PASSWORD).json()["token"]

        self.client.patch(f"/admin/users/{user['id']}", json={"is_active": False}, headers=self.as_admin())
        blocked = self.login(self.email("ada"), GOOD_PASSWORD)
        old_session = self.me(token)
        self.client.patch(f"/admin/users/{user['id']}", json={"is_active": True}, headers=self.as_admin())
        back = self.login(self.email("ada"), GOOD_PASSWORD)

        self.assertEqual(blocked.status_code, 401)
        self.assertEqual(blocked.json()["detail"], GENERIC_LOGIN_ERROR)
        self.assertEqual(old_session.status_code, 401)
        self.assertEqual(back.status_code, 200)

    def test_students_and_guests_cannot_reach_admin_routes(self):
        self.make_user("ada")
        token = self.login(self.email("ada"), GOOD_PASSWORD).json()["token"]

        self.assertEqual(self.client.get("/admin/users", headers=self.bearer(token)).status_code, 403)
        self.assertEqual(self.client.get("/admin/users").status_code, 401)


if __name__ == "__main__":
    unittest.main()
