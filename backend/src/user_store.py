import logging
from typing import Optional

import psycopg

from src.shared.common_fn import get_value_from_env

logger = logging.getLogger(__name__)


def _get_pg_config() -> dict:
    return {
        "host": get_value_from_env("POSTGRES_HOST", default_value="postgres", data_type=str),
        "port": get_value_from_env("POSTGRES_PORT", default_value=5432, data_type=int),
        "dbname": get_value_from_env("POSTGRES_DB", default_value="cora_users", data_type=str),
        "user": get_value_from_env("POSTGRES_USER", default_value="cora", data_type=str),
        "password": get_value_from_env("POSTGRES_PASSWORD", default_value="cora", data_type=str),
    }


def _get_connection() -> psycopg.Connection:
    config = _get_pg_config()
    return psycopg.connect(**config)


def _ensure_users_table(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS app_users (
                id SERIAL PRIMARY KEY,
                auth0_sub TEXT UNIQUE NOT NULL,
                email TEXT,
                role TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_login TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
    conn.commit()


def upsert_user(auth0_sub: str, email: Optional[str], default_role: str) -> str:
    with _get_connection() as conn:
        _ensure_users_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_users (auth0_sub, email, role)
                VALUES (%s, %s, %s)
                ON CONFLICT (auth0_sub)
                DO UPDATE SET email = EXCLUDED.email, last_login = NOW()
                RETURNING role;
                """,
                (auth0_sub, email, default_role),
            )
            role = cur.fetchone()[0]
        conn.commit()
        return role


def get_user_role(auth0_sub: str) -> Optional[str]:
    with _get_connection() as conn:
        _ensure_users_table(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT role FROM app_users WHERE auth0_sub = %s", (auth0_sub,))
            row = cur.fetchone()
            return row[0] if row else None


def set_user_role(auth0_sub: str, email: Optional[str], role: str) -> str:
    with _get_connection() as conn:
        _ensure_users_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_users (auth0_sub, email, role)
                VALUES (%s, %s, %s)
                ON CONFLICT (auth0_sub)
                DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, last_login = NOW()
                RETURNING role;
                """,
                (auth0_sub, email, role),
            )
            updated_role = cur.fetchone()[0]
        conn.commit()
        return updated_role


def list_users() -> list[dict]:
    with _get_connection() as conn:
        _ensure_users_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT auth0_sub, email, role, created_at, last_login
                FROM app_users
                ORDER BY created_at DESC;
                """
            )
            rows = cur.fetchall()
    return [
        {
            "auth0_sub": row[0],
            "email": row[1],
            "role": row[2],
            "created_at": row[3],
            "last_login": row[4],
        }
        for row in rows
    ]
