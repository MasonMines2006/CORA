import json
import logging
import time
from functools import lru_cache
from typing import Optional

import requests
from fastapi import Depends, HTTPException, Request, status
from jose import jwt
from langchain_neo4j import Neo4jGraph

from src.shared.common_fn import get_value_from_env

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


def verify_jwt_token(token: str, settings: AuthSettings) -> dict:
    try:
        jwks = _jwks_cache(settings.issuer)
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if not key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token header")

        payload = jwt.decode(
            token,
            key,
            audience=settings.audience,
            issuer=settings.issuer,
            options={"verify_at_hash": False},
        )
        return payload
    except Exception as exc:  # broad by design to return 401 on any failure
        logger.error("JWT verification failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


def get_bearer_token(request: Request) -> str:
    auth_header: Optional[str] = request.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header missing")
    return auth_header.split(" ", 1)[1]


# --- User directory (separate Neo4j DB) ---

def get_user_graph() -> Neo4jGraph:
    uri = get_value_from_env("USER_DB_URI", default_value=None, data_type=str)
    user = get_value_from_env("USER_DB_USERNAME", default_value=None, data_type=str)
    password = get_value_from_env("USER_DB_PASSWORD", default_value=None, data_type=str)
    database = get_value_from_env("USER_DB_DATABASE", default_value="users", data_type=str)
    if not all([uri, user, password]):
        raise RuntimeError("User DB credentials are missing")
    return Neo4jGraph(url=uri, username=user, password=password, database=database, refresh_schema=False, sanitize=True)


def upsert_user(email: str, default_role: str) -> str:
    graph = get_user_graph()
    query = (
        "MERGE (u:User {email: $email}) "
        "ON CREATE SET u.role=$role, u.created_at=timestamp(), u.last_login=timestamp() "
        "ON MATCH SET u.last_login=timestamp() "
        "RETURN u.role AS role"
    )
    result = graph.query(query, {"email": email, "role": default_role})
    return result[0]["role"] if result else default_role


def get_user_role(email: str) -> Optional[str]:
    graph = get_user_graph()
    result = graph.query("MATCH (u:User {email:$email}) RETURN u.role AS role", {"email": email})
    if result:
        return result[0].get("role")
    return None


def set_user_role(email: str, role: str) -> str:
    graph = get_user_graph()
    query = (
        "MERGE (u:User {email:$email}) "
        "SET u.role=$role, u.last_login=timestamp() "
        "RETURN u.role AS role"
    )
    result = graph.query(query, {"email": email, "role": role})
    return result[0]["role"] if result else role


def list_users() -> list:
    graph = get_user_graph()
    records = graph.query("MATCH (u:User) RETURN u.email AS email, u.role AS role, u.created_at AS created_at, u.last_login AS last_login")
    return [dict(r) for r in records]


# --- FastAPI dependencies ---

def get_current_user(request: Request, settings: AuthSettings = Depends(get_auth_settings)) -> dict:
    token = get_bearer_token(request)
    payload = verify_jwt_token(token, settings)
    email = payload.get("email") or payload.get("sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email not found in token")
    default_role = get_value_from_env("DEFAULT_ROLE", default_value="student", data_type=str)
    role = upsert_user(email, default_role)
    return {"email": email, "role": role, "token_payload": payload}


def require_role(required_roles: list[str]):
    def _role_checker(user = Depends(get_current_user)):
        role = user.get("role")
        if role not in required_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return _role_checker
