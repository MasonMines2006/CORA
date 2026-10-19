"""Local-development login shortcut.

WHAT IT IS
    In local dev, a person or a Playwright test can send the header

        X-Dev-User: student      (or: ta, admin)

    instead of logging in through the Auth0 hosted page. The backend then treats the
    request as coming from a fixed, fake user for that role (for example `dev|admin`)
    and writes a matching row into the `app_users` table.

WHY IT IS SAFE (fail closed)
    This is an authentication bypass, so it must never switch on by accident. It is
    ON only when BOTH of these environment variables are set, exactly:

        DEV_AUTH_BYPASS=true
        APP_ENV=development

    Two independent switches means a single copy-pasted line in a production `.env`
    is not enough. Anything else -- either one missing, misspelled, `1`, `yes` --
    leaves it OFF. When it is OFF and a request still sends `X-Dev-User`, the request
    is rejected with 401 rather than quietly treated as a guest, so a misconfigured
    setup is obvious instead of confusing.

    Only the three roles below are accepted, and each maps to one fixed fake user. A
    caller cannot choose an arbitrary user id or email, so the shortcut cannot be used
    to impersonate a real Auth0 account.

    Only docker-compose.dev.yml sets these variables. docker-compose.yml (the
    production-style file) never does.
"""

import logging
import os
from typing import Optional

from fastapi import HTTPException, Request, status

from src.user_store import set_user_role

logger = logging.getLogger(__name__)

# The HTTP header the frontend's dev login panel (and Playwright) sends.
DEV_USER_HEADER = "X-Dev-User"

# role -> fixed fake identity. `dev|` cannot collide with a real Auth0 subject,
# which always looks like `auth0|...` or `google-oauth2|...`.
DEV_USERS = {
    "student": {"auth0_sub": "dev|student", "email": "student@dev.cora.local"},
    "ta": {"auth0_sub": "dev|ta", "email": "ta@dev.cora.local"},
    "admin": {"auth0_sub": "dev|admin", "email": "admin@dev.cora.local"},
}


def _flag_is_on() -> bool:
    return os.environ.get("DEV_AUTH_BYPASS", "").strip().lower() == "true"


def _is_development() -> bool:
    return os.environ.get("APP_ENV", "").strip().lower() == "development"


def is_dev_auth_enabled() -> bool:
    """True only when BOTH switches are set. Read on every call, never cached,
    so turning it off takes effect on the next container restart with no surprises."""
    return _flag_is_on() and _is_development()


def has_dev_header(request: Request) -> bool:
    return request.headers.get(DEV_USER_HEADER) is not None


def _reject() -> HTTPException:
    # Deliberately vague: do not tell a caller *which* switch is missing.
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Dev login is not available")


def resolve_dev_user(request: Request) -> Optional[dict]:
    """Return a user dict for a valid dev login, or None if the request has no dev header.

    Raises 401 if the header is present but dev login is off or the role is unknown.
    """
    if not has_dev_header(request):
        return None

    if not is_dev_auth_enabled():
        logger.warning("Rejected %s header: dev login is disabled.", DEV_USER_HEADER)
        raise _reject()

    # Exact match only: "admin", not "ADMIN " or "admin;drop".
    role = request.headers.get(DEV_USER_HEADER, "")
    identity = DEV_USERS.get(role)
    if identity is None:
        raise _reject()

    # Upsert the app_users row with this role, so admin screens such as GET /users
    # show the dev accounts like any other user.
    stored_role = set_user_role(identity["auth0_sub"], identity["email"], role)
    return {
        "auth0_sub": identity["auth0_sub"],
        "email": identity["email"],
        "role": stored_role,
        "token_payload": {"dev_login": True},
    }


def log_startup_status() -> None:
    """Call once at startup. Shouts when the bypass is on, and when it was asked for but refused."""
    if is_dev_auth_enabled():
        logger.warning(
            "!!! DEV_AUTH_BYPASS is ON (APP_ENV=development). Any request with an %s header "
            "is logged in as student/ta/admin WITHOUT Auth0. Never run this configuration "
            "anywhere but your own machine. !!!",
            DEV_USER_HEADER,
        )
    elif _flag_is_on():
        logger.error(
            "DEV_AUTH_BYPASS=true was ignored because APP_ENV is not 'development'. "
            "Dev login stays OFF."
        )
