import logging
from functools import lru_cache
from typing import Optional
from uuid import UUID

import requests
from fastapi import Depends, HTTPException, Request, status
from jose import jwt
from src.shared.common_fn import get_value_from_env
from src.user_store import (
    consume_guest_chat_quota,
    ensure_users_table,
    get_user_role,
    list_users,
    set_role_by_email,
    set_user_role,
    upsert_user,
)

JWT_ALGORITHMS = ["RS256"]

logger = logging.getLogger(__name__)


class AuthSettings:
    domain: str
    audience: str
    issuer: str

    def __init__(self) -> None:
        self.domain = get_value_from_env("AUTH0_DOMAIN", default_value=None, data_type=str)
        self.audience = get_value_from_env("AUTH0_AUDIENCE", default_value=None, data_type=str)
        self.issuer = get_value_from_env("AUTH0_ISSUER", default_value=None, data_type=str)
        if not all([self.domain, self.audience, self.issuer]):
            raise RuntimeError("Auth0 configuration is missing. Please set AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_ISSUER")


def get_auth_settings() -> AuthSettings:
    return AuthSettings()


@lru_cache(maxsize=1)
def _jwks_cache(issuer: str) -> dict:
    jwks_url = f"{issuer}.well-known/jwks.json"
    response = requests.get(jwks_url, timeout=5)
    response.raise_for_status()
    return response.json()


def _find_signing_key(jwks: dict, kid: Optional[str]) -> Optional[dict]:
    return next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)


def verify_jwt_token(token: str, settings: AuthSettings) -> dict:
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        key = _find_signing_key(_jwks_cache(settings.issuer), kid)
        if not key:
            # kid not found could mean Auth0 rotated its signing key since we
            # cached the JWKS - refetch once before giving up, instead of
            # 401-ing every request until the process restarts.
            _jwks_cache.cache_clear()
            key = _find_signing_key(_jwks_cache(settings.issuer), kid)
        if not key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token header")

        payload = jwt.decode(
            token,
            key,
            algorithms=JWT_ALGORITHMS,
            audience=settings.audience,
            issuer=settings.issuer,
            options={"verify_at_hash": False},
        )
        return payload
    except HTTPException:
        raise
    except Exception as exc:  # broad by design to return 401 on any failure
        logger.error("JWT verification failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


def get_bearer_token(request: Request) -> str:
    auth_header: Optional[str] = request.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header missing")
    return auth_header.split(" ", 1)[1]


# --- User directory (PostgreSQL) ---


# --- FastAPI dependencies ---

def get_current_user(request: Request, settings: AuthSettings = Depends(get_auth_settings)) -> dict:
    token = get_bearer_token(request)
    payload = verify_jwt_token(token, settings)
    auth0_sub = payload.get("sub")
    email = payload.get("email")
    if not auth0_sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User id not found in token")
    default_role = get_value_from_env("DEFAULT_ROLE", default_value="student", data_type=str)
    role = upsert_user(auth0_sub, email, default_role)
    return {"auth0_sub": auth0_sub, "email": email, "role": role, "token_payload": payload}


def get_learner(request: Request, settings: AuthSettings = Depends(get_auth_settings)) -> dict:
    """Resolve either a verified Auth0 user or a scoped anonymous learner."""
    auth_header: Optional[str] = request.headers.get("Authorization")
    if auth_header:
        user = get_current_user(request, settings)
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


def get_chat_learner(request: Request, settings: AuthSettings = Depends(get_auth_settings)) -> dict:
    """Resolve a learner and enforce the public guest Chat cost boundary."""
    learner = get_learner(request, settings)
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
