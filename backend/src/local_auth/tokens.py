"""CORA's session tokens and one-time link tokens.

SESSION TOKENS
    After a good sign-in, CORA gives the browser a JWT signed with
    CORA_JWT_SECRET (HMAC-SHA256). The browser sends it back on every request as
    `Authorization: Bearer <token>`. Anyone can *read* a JWT, but only someone
    holding the secret can *make* one, so the server can trust its contents.

    Why a bearer token and not an httpOnly cookie: the frontend and backend run
    on different origins (ports locally, separate hosts when deployed). Cookies
    across origins need CORS credentials and CSRF protection to be safe; a bearer
    token in a header needs neither, and the existing axios client already sends
    one. The cost is that page JavaScript can read the token, so an XSS bug could
    steal it. React escapes text by default, and tokens expire (8 hours, or
    14 days with "Keep me signed in").

    The token carries the user's id and a `ver` (token version). Changing a
    password or deactivating an account bumps the version in the database, which
    makes every older token useless: "signed out everywhere".

ONE-TIME LINK TOKENS
    Invite and password-reset links contain a long random string. The database
    stores only its SHA-256 hash, so someone who reads the database still can't
    use a pending link.
"""

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

ALGORITHM = "HS256"
ISSUER = "cora"
MIN_SECRET_LENGTH = 32
SESSION_HOURS = 8
KEEP_SIGNED_IN_DAYS = 14


class InvalidSessionToken(Exception):
    """The token is missing, malformed, tampered with, wrongly signed or expired."""


def jwt_secret() -> str:
    secret = (os.getenv("CORA_JWT_SECRET") or "").strip()
    if len(secret) < MIN_SECRET_LENGTH:
        # Fail loudly rather than sign tokens with a guessable key.
        raise RuntimeError(
            f"CORA_JWT_SECRET must be set to a random string of at least {MIN_SECRET_LENGTH} characters"
        )
    return secret


def issue_session_token(*, user_id: int, subject: str, token_version: int, keep_signed_in: bool) -> tuple[str, datetime]:
    """Return (token, expires_at) for a signed-in user."""
    now = datetime.now(timezone.utc)
    lifetime = timedelta(days=KEEP_SIGNED_IN_DAYS) if keep_signed_in else timedelta(hours=SESSION_HOURS)
    expires_at = now + lifetime
    claims = {
        "sub": subject,
        "uid": user_id,
        "ver": token_version,
        "iss": ISSUER,
        "iat": now,
        "exp": expires_at,
    }
    return jwt.encode(claims, jwt_secret(), algorithm=ALGORITHM), expires_at


def read_session_token(token: str) -> dict:
    """Return the token's claims, or raise InvalidSessionToken."""
    try:
        # `algorithms=[ALGORITHM]` matters: it refuses "alg: none" and any other
        # algorithm an attacker might put in the token header.
        claims = jwt.decode(token, jwt_secret(), algorithms=[ALGORITHM], issuer=ISSUER)
    except JWTError as exc:
        raise InvalidSessionToken("Invalid or expired session") from exc
    if not isinstance(claims.get("uid"), int) or not isinstance(claims.get("ver"), int):
        raise InvalidSessionToken("Invalid session")
    return claims


def new_link_token() -> tuple[str, str]:
    """Return (raw token for the link, hash to store)."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_link_token(raw)


def hash_link_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
