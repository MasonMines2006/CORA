"""The building blocks of CORA's own login: passwords, session tokens, rate limits.

CORA used to hand sign-in to Auth0. It now checks email + password itself and
issues its own signed session token (a JWT). These tests pin the rules that
don't need a database:

- Passwords are stored as argon2id hashes, never as text, and the rules match
  the sign-up screen (at least 12 characters, not a common password, not the email).
- Session tokens are signed with CORA_JWT_SECRET. A tampered, expired or
  wrongly-signed token is refused. A missing or short secret stops the app
  instead of running with a guessable one.
- One-time links (invites, password resets) are random, and only their hash is stored.
- The per-address limiter refuses requests past its budget.
"""

import os
import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from jose import jwt

from src.local_auth import passwords, tokens
from src.local_auth.rate_limit import SlidingWindowLimiter

SECRET = "x" * 48
SECRET_ENV = {"CORA_JWT_SECRET": SECRET}


class PasswordHashingTests(unittest.TestCase):
    def test_hash_is_argon2id_and_never_the_password(self):
        hashed = passwords.hash_password("correct horse battery staple")

        self.assertTrue(hashed.startswith("$argon2id$"))
        self.assertNotIn("correct horse", hashed)

    def test_right_password_verifies(self):
        hashed = passwords.hash_password("correct horse battery staple")

        self.assertTrue(passwords.verify_password(hashed, "correct horse battery staple"))

    def test_wrong_password_does_not_verify(self):
        hashed = passwords.hash_password("correct horse battery staple")

        self.assertFalse(passwords.verify_password(hashed, "correct horse battery stapl"))

    def test_missing_or_garbage_hash_does_not_verify(self):
        self.assertFalse(passwords.verify_password(None, "anything"))
        self.assertFalse(passwords.verify_password("not-a-hash", "anything"))

    def test_same_password_hashes_differently_each_time(self):
        # A random salt per hash means two people with the same password
        # don't end up with the same stored value.
        self.assertNotEqual(passwords.hash_password("same password 123"), passwords.hash_password("same password 123"))


class PasswordRuleTests(unittest.TestCase):
    def test_good_password_has_no_problems(self):
        self.assertEqual(passwords.password_problems("decay heat is not zero", "a@b.edu"), [])

    def test_short_password_is_rejected(self):
        self.assertIn("Use at least 12 characters.", passwords.password_problems("short1", "a@b.edu"))

    def test_common_password_is_rejected(self):
        self.assertIn(
            "That password is too common. Pick something less guessable.",
            passwords.password_problems("password1234", "a@b.edu"),
        )

    def test_password_equal_to_email_is_rejected(self):
        self.assertIn(
            "Don't use your email address as your password.",
            passwords.password_problems("Student@School.edu", "student@school.edu"),
        )

    def test_absurdly_long_password_is_rejected(self):
        # Hashing a megabyte of text on every login attempt is a cheap way to
        # tie up the server, so there is an upper bound too.
        self.assertIn("Use at most 128 characters.", passwords.password_problems("a" * 129, "a@b.edu"))


class SessionTokenTests(unittest.TestCase):
    def setUp(self):
        patcher = patch.dict(os.environ, SECRET_ENV)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_round_trip_keeps_subject_user_and_version(self):
        token, _ = tokens.issue_session_token(user_id=7, subject="cora|7", token_version=3, keep_signed_in=False)

        claims = tokens.read_session_token(token)

        self.assertEqual((claims["sub"], claims["uid"], claims["ver"]), ("cora|7", 7, 3))

    def test_keep_signed_in_lasts_longer(self):
        _, short = tokens.issue_session_token(user_id=7, subject="cora|7", token_version=0, keep_signed_in=False)
        _, long = tokens.issue_session_token(user_id=7, subject="cora|7", token_version=0, keep_signed_in=True)

        self.assertGreater(long - short, timedelta(days=1))

    def test_tampered_token_is_refused(self):
        token, _ = tokens.issue_session_token(user_id=7, subject="cora|7", token_version=0, keep_signed_in=False)
        header, payload, signature = token.split(".")
        tampered = ".".join([header, payload, signature[:-2] + ("AA" if signature[-2:] != "AA" else "BB")])

        with self.assertRaises(tokens.InvalidSessionToken):
            tokens.read_session_token(tampered)

    def test_token_signed_with_another_secret_is_refused(self):
        forged = jwt.encode(
            {"sub": "cora|1", "uid": 1, "ver": 0, "iss": tokens.ISSUER,
             "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            "y" * 48,
            algorithm="HS256",
        )

        with self.assertRaises(tokens.InvalidSessionToken):
            tokens.read_session_token(forged)

    def test_unsigned_alg_none_token_is_refused(self):
        # The classic JWT trick: claim "no signature needed".
        unsigned = jwt.encode({"sub": "cora|1", "uid": 1, "ver": 0, "iss": tokens.ISSUER}, "", algorithm="HS256")
        header_none = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0"
        _, payload, _ = unsigned.split(".")

        with self.assertRaises(tokens.InvalidSessionToken):
            tokens.read_session_token(f"{header_none}.{payload}.")

    def test_expired_token_is_refused(self):
        expired = jwt.encode(
            {"sub": "cora|1", "uid": 1, "ver": 0, "iss": tokens.ISSUER,
             "exp": datetime.now(timezone.utc) - timedelta(seconds=5)},
            SECRET,
            algorithm="HS256",
        )

        with self.assertRaises(tokens.InvalidSessionToken):
            tokens.read_session_token(expired)

    def test_garbage_is_refused(self):
        with self.assertRaises(tokens.InvalidSessionToken):
            tokens.read_session_token("not.a.token")


class SecretConfigTests(unittest.TestCase):
    def test_missing_secret_stops_token_issuing(self):
        with patch.dict(os.environ, {"CORA_JWT_SECRET": ""}):
            with self.assertRaises(RuntimeError):
                tokens.issue_session_token(user_id=1, subject="cora|1", token_version=0, keep_signed_in=False)

    def test_short_secret_stops_token_issuing(self):
        with patch.dict(os.environ, {"CORA_JWT_SECRET": "too-short"}):
            with self.assertRaises(RuntimeError):
                tokens.issue_session_token(user_id=1, subject="cora|1", token_version=0, keep_signed_in=False)


class OneTimeLinkTokenTests(unittest.TestCase):
    def test_link_tokens_are_long_random_and_stored_only_as_hashes(self):
        raw_a, hash_a = tokens.new_link_token()
        raw_b, _ = tokens.new_link_token()

        self.assertNotEqual(raw_a, raw_b)
        self.assertGreaterEqual(len(raw_a), 40)
        self.assertNotEqual(raw_a, hash_a)
        self.assertEqual(tokens.hash_link_token(raw_a), hash_a)


class RateLimiterTests(unittest.TestCase):
    def test_allows_up_to_the_limit_then_refuses(self):
        limiter = SlidingWindowLimiter(max_events=3, window_seconds=60)

        results = [limiter.allow("1.2.3.4") for _ in range(4)]

        self.assertEqual(results, [True, True, True, False])

    def test_keys_are_counted_separately(self):
        limiter = SlidingWindowLimiter(max_events=1, window_seconds=60)

        self.assertTrue(limiter.allow("1.1.1.1"))
        self.assertTrue(limiter.allow("2.2.2.2"))

    def test_old_events_fall_out_of_the_window(self):
        limiter = SlidingWindowLimiter(max_events=1, window_seconds=0.05)
        self.assertTrue(limiter.allow("k"))

        time.sleep(0.06)

        self.assertTrue(limiter.allow("k"))


if __name__ == "__main__":
    unittest.main()
