"""Who is making this request?

Three kinds of caller:
- A signed-in person, sending `Authorization: Bearer <CORA session token>`.
  CORA issues these itself after an email + password sign-in (src/local_auth).
- Local development, sending `X-Dev-User: student|ta|admin` (src/dev_auth.py,
  off unless two switches are both on).
- An anonymous guest, sending `X-Guest-Id: <uuid4>` (learning routes and Chat only).

Every signed-in user dict carries `auth0_sub`: the person's stable id used as the
learner id across CORA. The name is a leftover from Auth0; local accounts have
ids like `cora|<uuid>`.
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status

from src import dev_auth
from src.local_auth.service import user_from_session_token
from src.shared.common_fn import get_value_from_env
from src.user_store import consume_guest_chat_quota, ensure_users_table  # noqa: F401  (re-exported for score.py)

logger = logging.getLogger(__name__)


def get_bearer_token(request: Request) -> str:
    auth_header: Optional[str] = request.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header missing")
    return auth_header.split(" ", 1)[1].strip()


# --- FastAPI dependencies ---

def get_current_user(request: Request) -> dict:
    # Local-dev login shortcut. Returns None when the request has no X-Dev-User
    # header, and raises 401 when it has one but dev login is switched off.
    # See src/dev_auth.py for the two switches that must both be on.
    dev_user = dev_auth.resolve_dev_user(request)
    if dev_user is not None:
        return dev_user

    user = user_from_session_token(get_bearer_token(request))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
    return {
        "auth0_sub": user["subject"],
        "user_id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
    }


def get_learner(request: Request) -> dict:
    """Resolve either a signed-in user or a scoped anonymous learner."""
    auth_header: Optional[str] = request.headers.get("Authorization")
    # A dev-login header is handled like a token: get_current_user accepts it or
    # rejects it with 401. It never falls through to guest mode.
    if auth_header or dev_auth.has_dev_header(request):
        user = get_current_user(request)
        return {**user, "learner_id": user["auth0_sub"]}

    raw_guest_id = request.headers.get("X-Guest-Id", "").strip().lower()
    try:
        guest_uuid = UUID(raw_guest_id)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid learner identity is required",
        )

    if guest_uuid.version != 4 or str(guest_uuid) != raw_guest_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid learner identity is required",
        )

    return {"learner_id": f"guest:{guest_uuid}", "role": "guest", "email": None}


def get_chat_learner(request: Request) -> dict:
    """Resolve a learner and enforce the public guest Chat cost boundary."""
    learner = get_learner(request)
    if learner["role"] != "guest":
        return learner

    hourly_limit = get_value_from_env("GUEST_CHAT_HOURLY_LIMIT", default_value=10, data_type=int)
    request_count = consume_guest_chat_quota(learner["learner_id"], hourly_limit)
    if request_count is None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Guest Chat is limited to {hourly_limit} questions per hour. Please try again later.",
        )
    return {**learner, "guest_chat_requests_this_hour": request_count}


def require_role(required_roles: list[str]):
    def _role_checker(user = Depends(get_current_user)):
        role = user.get("role")
        if role not in required_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return _role_checker
