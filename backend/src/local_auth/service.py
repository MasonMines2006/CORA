"""The sign-in rules, with no HTTP in sight.

router.py turns the exceptions below into HTTP responses. Keeping the rules
here means they read top to bottom without FastAPI details in the way.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from src.local_auth import passwords, store, tokens

MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 15
INVITE_LIFETIME = timedelta(days=7)
RESET_LIFETIME = timedelta(hours=24)
# Only these roles can be handed out by invite. test_full stays a dev-only role.
INVITABLE_ROLES = ("student", "ta", "admin")


class LoginFailed(Exception):
    """Wrong email, wrong password, locked or deactivated: deliberately one error."""


class RegistrationClosed(Exception):
    pass


class WeakPassword(Exception):
    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems))
        self.problems = problems


class LinkInvalid(Exception):
    """The invite or reset link is unknown, used or expired."""


class WrongCurrentPassword(Exception):
    pass


class NotAllowed(Exception):
    """An admin action that would lock the admin out of their own account."""


def _check_password(password: str, email: str) -> None:
    problems = passwords.password_problems(password, email)
    if problems:
        raise WeakPassword(problems)


def _is_locked(user: dict) -> bool:
    return user["locked_until"] is not None and user["locked_until"] > datetime.now(timezone.utc)


def session_for(user: dict, keep_signed_in: bool = False) -> dict:
    """The response body a successful sign-in returns."""
    token, expires_at = tokens.issue_session_token(
        user_id=user["id"], subject=user["subject"], token_version=user["token_version"], keep_signed_in=keep_signed_in
    )
    return {"token": token, "expires_at": expires_at.isoformat(), "user": public_user(user)}


def public_user(user: dict) -> dict:
    """The fields it's safe to send to the browser (never the hash or lock state)."""
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}


def login(email: str, password: str) -> dict:
    """Return the user for a correct email + password, else raise LoginFailed."""
    user = store.find_local_user_by_email(email)
    if user is None:
        passwords.burn_time_like_a_real_check(password)
        raise LoginFailed()
    if _is_locked(user):
        # Don't check (or count) passwords while locked, but take the same time.
        passwords.burn_time_like_a_real_check(password)
        raise LoginFailed()
    if not passwords.verify_password(user["password_hash"], password):
        store.record_failed_login(user["id"], MAX_FAILED_LOGINS, LOCK_MINUTES)
        raise LoginFailed()
    if not user["is_active"]:
        raise LoginFailed()
    store.record_successful_login(user["id"])
    return user


def user_from_session_token(token: str) -> Optional[dict]:
    """The signed-in user behind a session token, or None if it no longer counts.

    A token stops counting when it is invalid or expired, when the account is
    deactivated, or when its version is older than the account's (password
    changed or reset, or deactivated since the token was issued).
    """
    try:
        claims = tokens.read_session_token(token)
    except tokens.InvalidSessionToken:
        return None
    user = store.get_user(claims["uid"])
    if user is None or not user["is_active"]:
        return None
    if user["token_version"] != claims["ver"] or user["subject"] != claims["sub"]:
        return None
    return user


def register(email: str, name: str, password: str) -> dict:
    """Open-enrollment sign-up. Always creates a student."""
    if not store.get_open_enrollment():
        raise RegistrationClosed()
    _check_password(password, email)
    return store.create_user(email, name, passwords.hash_password(password), "student")


def invite(emails: list[str], role: str, admin: dict) -> tuple[list[dict], list[str]]:
    """Create one single-use invite link per email. Emails that already have an account are skipped."""
    created, skipped = [], []
    for email in dict.fromkeys(store.normalize_email(e) for e in emails):  # de-duplicate, keep order
        if store.find_local_user_by_email(email) is not None:
            skipped.append(email)
            continue
        raw = store.create_link("invite", email, role, None, admin["auth0_sub"], INVITE_LIFETIME)
        created.append({"email": email, "role": role, "token": raw, "expires_at": _from_now(INVITE_LIFETIME)})
    return created, skipped


def preview_link(kind: str, raw: str) -> dict:
    link = store.peek_link(kind, raw)
    if link is None:
        raise LinkInvalid()
    return link


def accept_invite(raw: str, name: str, password: str) -> dict:
    link = preview_link("invite", raw)
    _check_password(password, link["email"])
    user = store.accept_invite(raw, name, passwords.hash_password(password))
    if user is None:
        raise LinkInvalid()
    return user


def issue_reset_link(user_id: int, admin: dict) -> dict:
    user = store.get_user(user_id)
    if user is None or not user["subject"].startswith(store.LOCAL_SUBJECT_PREFIX):
        raise LinkInvalid()
    raw = store.create_link("reset", user["email"], None, user_id, admin["auth0_sub"], RESET_LIFETIME)
    return {"email": user["email"], "token": raw, "expires_at": _from_now(RESET_LIFETIME)}


def complete_reset(raw: str, password: str) -> None:
    link = preview_link("reset", raw)
    _check_password(password, link["email"])
    if store.complete_reset(raw, passwords.hash_password(password)) is None:
        raise LinkInvalid()


def change_password(user_id: int, current_password: str, new_password: str) -> dict:
    user = store.get_user(user_id)
    if user is None or _is_locked(user):
        raise WrongCurrentPassword()
    if not passwords.verify_password(user["password_hash"], current_password):
        # Count it like a failed sign-in, so a stolen session token can't be
        # used to guess the password forever.
        store.record_failed_login(user_id, MAX_FAILED_LOGINS, LOCK_MINUTES)
        raise WrongCurrentPassword()
    _check_password(new_password, user["email"])
    return store.set_password(user_id, passwords.hash_password(new_password))


def update_user(user_id: int, admin: dict, role: Optional[str], is_active: Optional[bool]) -> Optional[dict]:
    if admin.get("user_id") == user_id or admin.get("auth0_sub") == _subject_of(user_id):
        # Stops an admin removing their own access by accident.
        raise NotAllowed()
    return store.update_user(user_id, role=role, is_active=is_active)


def _subject_of(user_id: int) -> Optional[str]:
    user = store.get_user(user_id)
    return user["subject"] if user else None


def _from_now(lifetime: timedelta) -> str:
    return (datetime.now(timezone.utc) + lifetime).isoformat()
