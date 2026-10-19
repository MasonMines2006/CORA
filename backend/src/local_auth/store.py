"""Postgres storage for CORA's own sign-in.

Builds on the existing `app_users` table (one row per person, with their role)
by adding columns rather than making a new table, so every existing query that
reads roles keeps working. Everything here is additive: `ADD COLUMN IF NOT
EXISTS` and `CREATE TABLE IF NOT EXISTS`, safe to run on every startup.

A note on the `auth0_sub` column: it is the person's stable id used all over
CORA (learner progress, chat history, quizzes are keyed by it). The name is a
leftover from Auth0. Local accounts get an id like `cora|<random uuid>`.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb

from src.local_auth.tokens import hash_link_token, new_link_token
from src.user_store import VALID_ROLES, ensure_users_table, get_pool

LOCAL_SUBJECT_PREFIX = "cora|"
LINK_KINDS = ("invite", "reset")


class EmailTaken(Exception):
    """A local account with this email already exists."""


def normalize_email(email: str) -> str:
    return email.strip().lower()


def ensure_auth_tables() -> None:
    """Create or extend the sign-in tables. Call once at startup."""
    ensure_users_table()
    with get_pool().connection() as conn:
        conn.execute(
            """
            ALTER TABLE app_users
                ADD COLUMN IF NOT EXISTS display_name TEXT,
                ADD COLUMN IF NOT EXISTS password_hash TEXT,
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS failed_logins INTEGER NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
            """
        )
        # One local account per email. (The older index on email is deliberately
        # not unique, because Auth0 allowed two identities with one email.)
        conn.execute(
            f"""
            CREATE UNIQUE INDEX IF NOT EXISTS app_users_local_email_key
                ON app_users (lower(email)) WHERE auth0_sub LIKE '{LOCAL_SUBJECT_PREFIX}%';
            """
        )
        conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS auth_links (
                token_hash TEXT PRIMARY KEY,
                kind TEXT NOT NULL CHECK (kind IN {LINK_KINDS}),
                email TEXT NOT NULL,
                role TEXT CHECK (role IS NULL OR role IN {VALID_ROLES}),
                user_id BIGINT REFERENCES app_users (id) ON DELETE CASCADE,
                created_by TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL,
                used_at TIMESTAMPTZ
            );
            CREATE INDEX IF NOT EXISTS auth_links_email_idx ON auth_links (lower(email));

            CREATE TABLE IF NOT EXISTS auth_settings (
                key TEXT PRIMARY KEY,
                value JSONB NOT NULL
            );
            """
        )
        conn.commit()


# --- users -------------------------------------------------------------------

_USER_COLUMNS = """
    id, auth0_sub, email, display_name, role, is_active, token_version,
    password_hash, failed_logins, locked_until, last_login, created_at
"""


def _user(row) -> Optional[dict]:
    if row is None:
        return None
    return {
        "id": row[0],
        "subject": row[1],
        "email": row[2],
        "name": row[3],
        "role": row[4],
        "is_active": row[5],
        "token_version": row[6],
        "password_hash": row[7],
        "failed_logins": row[8],
        "locked_until": row[9],
        "last_login": row[10],
        "created_at": row[11],
    }


def create_user(email: str, name: str, password_hash: str, role: str, conn=None) -> dict:
    """Insert a local account. Raises EmailTaken if the email is already used."""
    sql = f"""
        INSERT INTO app_users (auth0_sub, email, display_name, role, password_hash)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING {_USER_COLUMNS};
    """
    params = (f"{LOCAL_SUBJECT_PREFIX}{uuid4()}", normalize_email(email), name.strip(), role, password_hash)
    try:
        if conn is not None:
            return _user(conn.execute(sql, params).fetchone())
        with get_pool().connection() as own_conn:
            row = own_conn.execute(sql, params).fetchone()
            own_conn.commit()
            return _user(row)
    except UniqueViolation as exc:
        raise EmailTaken(email) from exc


def find_local_user_by_email(email: str) -> Optional[dict]:
    with get_pool().connection() as conn:
        row = conn.execute(
            f"SELECT {_USER_COLUMNS} FROM app_users WHERE lower(email) = %s AND auth0_sub LIKE %s;",
            (normalize_email(email), f"{LOCAL_SUBJECT_PREFIX}%"),
        ).fetchone()
    return _user(row)


def get_user(user_id: int) -> Optional[dict]:
    with get_pool().connection() as conn:
        row = conn.execute(f"SELECT {_USER_COLUMNS} FROM app_users WHERE id = %s;", (user_id,)).fetchone()
    return _user(row)


def record_failed_login(user_id: int, max_failures: int, lock_minutes: int) -> None:
    """Count one wrong password. On the last allowed one, lock and restart the count."""
    with get_pool().connection() as conn:
        conn.execute(
            """
            UPDATE app_users SET
                locked_until = CASE WHEN failed_logins + 1 >= %(max)s
                                    THEN NOW() + make_interval(mins => %(mins)s)
                                    ELSE locked_until END,
                failed_logins = CASE WHEN failed_logins + 1 >= %(max)s THEN 0 ELSE failed_logins + 1 END
            WHERE id = %(id)s;
            """,
            {"max": max_failures, "mins": lock_minutes, "id": user_id},
        )
        conn.commit()


def record_successful_login(user_id: int) -> None:
    with get_pool().connection() as conn:
        conn.execute(
            "UPDATE app_users SET failed_logins = 0, locked_until = NULL, last_login = NOW() WHERE id = %s;",
            (user_id,),
        )
        conn.commit()


def set_password(user_id: int, password_hash: str, conn=None) -> dict:
    """Store a new password hash and sign the person out everywhere (bump the token version)."""
    sql = f"""
        UPDATE app_users SET password_hash = %s, token_version = token_version + 1,
               failed_logins = 0, locked_until = NULL
        WHERE id = %s RETURNING {_USER_COLUMNS};
    """
    if conn is not None:
        return _user(conn.execute(sql, (password_hash, user_id)).fetchone())
    with get_pool().connection() as own_conn:
        row = own_conn.execute(sql, (password_hash, user_id)).fetchone()
        own_conn.commit()
    return _user(row)


def update_user(user_id: int, role: Optional[str] = None, is_active: Optional[bool] = None) -> Optional[dict]:
    """Change role and/or active status. Deactivating also signs the person out everywhere."""
    with get_pool().connection() as conn:
        row = conn.execute(
            f"""
            UPDATE app_users SET
                role = COALESCE(%(role)s::text, role),
                token_version = CASE WHEN %(active)s::boolean IS FALSE AND is_active THEN token_version + 1
                                     ELSE token_version END,
                is_active = COALESCE(%(active)s::boolean, is_active)
            WHERE id = %(id)s RETURNING {_USER_COLUMNS};
            """,
            {"role": role, "active": is_active, "id": user_id},
        ).fetchone()
        conn.commit()
    return _user(row)


def list_users() -> list[dict]:
    with get_pool().connection() as conn:
        rows = conn.execute(f"SELECT {_USER_COLUMNS} FROM app_users ORDER BY created_at DESC;").fetchall()
    return [_user(row) for row in rows]


# --- one-time links (invites and password resets) ------------------------------

def create_link(kind: str, email: str, role: Optional[str], user_id: Optional[int], created_by: str, ttl: timedelta) -> str:
    """Store a new single-use link and return its raw token (shown once, never stored)."""
    raw, token_hash = new_link_token()
    with get_pool().connection() as conn:
        conn.execute(
            """
            INSERT INTO auth_links (token_hash, kind, email, role, user_id, created_by, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
            """,
            (token_hash, kind, normalize_email(email), role, user_id, created_by, datetime.now(timezone.utc) + ttl),
        )
        conn.commit()
    return raw


_LINK_COLUMNS = "l.kind, l.email, l.role, l.user_id, l.created_at, l.expires_at, COALESCE(u.email, l.created_by)"


def _link(row) -> Optional[dict]:
    if row is None:
        return None
    keys = ("kind", "email", "role", "user_id", "created_at", "expires_at", "created_by")
    return dict(zip(keys, row))


def peek_link(kind: str, raw: str) -> Optional[dict]:
    """The link's details if it exists, is unused and hasn't expired; otherwise None."""
    with get_pool().connection() as conn:
        row = conn.execute(
            f"""
            SELECT {_LINK_COLUMNS}
            FROM auth_links l LEFT JOIN app_users u ON u.auth0_sub = l.created_by
            WHERE l.token_hash = %s AND l.kind = %s AND l.used_at IS NULL AND l.expires_at > NOW();
            """,
            (hash_link_token(raw), kind),
        ).fetchone()
    return _link(row)


def _consume_link(conn, kind: str, raw: str) -> Optional[dict]:
    """Mark the link used, atomically. Two simultaneous uses can't both succeed."""
    row = conn.execute(
        """
        UPDATE auth_links SET used_at = NOW()
        WHERE token_hash = %s AND kind = %s AND used_at IS NULL AND expires_at > NOW()
        RETURNING kind, email, role, user_id, created_at, expires_at, created_by;
        """,
        (hash_link_token(raw), kind),
    ).fetchone()
    return _link(row)


def accept_invite(raw: str, name: str, password_hash: str) -> Optional[dict]:
    """Use an invite and create its account in one transaction. None if the link is no good."""
    with get_pool().connection() as conn:
        link = _consume_link(conn, "invite", raw)
        if link is None:
            return None
        user = create_user(link["email"], name, password_hash, link["role"], conn=conn)
        conn.commit()
    return user


def complete_reset(raw: str, password_hash: str) -> Optional[dict]:
    """Use a reset link and set the new password in one transaction. None if the link is no good."""
    with get_pool().connection() as conn:
        link = _consume_link(conn, "reset", raw)
        if link is None:
            return None
        user = set_password(link["user_id"], password_hash, conn=conn)
        conn.commit()
    return user


def list_pending_invites() -> list[dict]:
    with get_pool().connection() as conn:
        rows = conn.execute(
            f"""
            SELECT {_LINK_COLUMNS}
            FROM auth_links l LEFT JOIN app_users u ON u.auth0_sub = l.created_by
            WHERE l.kind = 'invite' AND l.used_at IS NULL AND l.expires_at > NOW()
            ORDER BY l.created_at DESC;
            """
        ).fetchall()
    return [_link(row) for row in rows]


# --- settings ------------------------------------------------------------------

def get_open_enrollment() -> bool:
    with get_pool().connection() as conn:
        row = conn.execute("SELECT value FROM auth_settings WHERE key = 'open_enrollment';").fetchone()
    return bool(row and row[0] is True)


def set_open_enrollment(is_open: bool) -> None:
    with get_pool().connection() as conn:
        conn.execute(
            """
            INSERT INTO auth_settings (key, value) VALUES ('open_enrollment', %s)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
            """,
            (Jsonb(bool(is_open)),),
        )
        conn.commit()
