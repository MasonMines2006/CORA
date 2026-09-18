import logging
from typing import Any, Optional

from psycopg_pool import ConnectionPool
from psycopg.types.json import Jsonb

from src.shared.common_fn import get_value_from_env

logger = logging.getLogger(__name__)

# Roles the app actually checks for (see ALLOWED_ADMIN_ROLES / ALLOWED_MANAGER_ROLES
# in score.py, and DEFAULT_ROLE). Kept here too so the DB rejects typos at insert time.
VALID_ROLES = ("student", "ta", "admin", "test_full")

_pool: Optional[ConnectionPool] = None


def _get_pg_config() -> dict:
    return {
        "host": get_value_from_env("POSTGRES_HOST", default_value="postgres", data_type=str),
        "port": get_value_from_env("POSTGRES_PORT", default_value=5432, data_type=int),
        "dbname": get_value_from_env("POSTGRES_DB", default_value="cora_users", data_type=str),
        # No default for user/password: a misconfigured deploy should fail loudly
        # at startup instead of silently connecting with throwaway dev credentials.
        "user": get_value_from_env("POSTGRES_USER", default_value=None, data_type=str),
        "password": get_value_from_env("POSTGRES_PASSWORD", default_value=None, data_type=str),
    }


def get_pool() -> ConnectionPool:
    """Lazily create the process-wide connection pool (one per worker process)."""
    global _pool
    if _pool is None:
        config = _get_pg_config()
        if not config["user"] or not config["password"]:
            raise RuntimeError(
                "Postgres credentials are missing. Set POSTGRES_USER and POSTGRES_PASSWORD."
            )
        conninfo = (
            f"host={config['host']} port={config['port']} dbname={config['dbname']} "
            f"user={config['user']} password={config['password']}"
        )
        _pool = ConnectionPool(conninfo, min_size=1, max_size=10, open=True)
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def ensure_users_table() -> None:
    """Create the app_users table/index if needed. Call once at app startup, not per-request."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS app_users (
                    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    auth0_sub TEXT UNIQUE NOT NULL,
                    email TEXT,
                    role TEXT NOT NULL CHECK (role IN {VALID_ROLES}),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_login TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
            # Not UNIQUE: a single person can legitimately have two Auth0 identities
            # (e.g. Google login + email/password) sharing one email address.
            cur.execute("CREATE INDEX IF NOT EXISTS app_users_email_idx ON app_users (email);")
        conn.commit()


def ensure_learning_tables() -> None:
    """Create additive CORA learning tables without changing the user directory."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS learner_mastery (
                    learner_id TEXT NOT NULL,
                    concept_id TEXT NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
                    correct INTEGER NOT NULL DEFAULT 0 CHECK (correct >= 0 AND correct <= attempts),
                    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (learner_id, concept_id)
                );

                CREATE TABLE IF NOT EXISTS learning_content_cache (
                    concept_id TEXT NOT NULL,
                    content_type TEXT NOT NULL CHECK (content_type IN ('lesson', 'quiz')),
                    difficulty TEXT NOT NULL DEFAULT '',
                    source_hash TEXT NOT NULL,
                    payload JSONB NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (concept_id, content_type, difficulty, source_hash)
                );

                CREATE TABLE IF NOT EXISTS quiz_sessions (
                    id TEXT PRIMARY KEY,
                    learner_id TEXT NOT NULL,
                    concept_id TEXT NOT NULL,
                    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
                    questions JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    graded_at TIMESTAMPTZ,
                    score INTEGER
                );

                CREATE INDEX IF NOT EXISTS quiz_sessions_learner_idx
                    ON quiz_sessions (learner_id, created_at DESC);

                CREATE TABLE IF NOT EXISTS guest_chat_usage (
                    learner_id TEXT NOT NULL,
                    window_started_at TIMESTAMPTZ NOT NULL,
                    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
                    PRIMARY KEY (learner_id, window_started_at)
                );

                CREATE INDEX IF NOT EXISTS guest_chat_usage_window_idx
                    ON guest_chat_usage (window_started_at);
                """
            )
        conn.commit()


def consume_guest_chat_quota(learner_id: str, hourly_limit: int) -> Optional[int]:
    """Atomically consume one request in the guest's current UTC-hour window."""
    if not learner_id.startswith("guest:"):
        raise ValueError("Guest chat quota only applies to guest learners")
    if hourly_limit < 1:
        return None

    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO guest_chat_usage (learner_id, window_started_at, request_count)
                VALUES (%s, date_trunc('hour', NOW()), 1)
                ON CONFLICT (learner_id, window_started_at)
                DO UPDATE SET request_count = guest_chat_usage.request_count + 1
                WHERE guest_chat_usage.request_count < %s
                RETURNING request_count;
                """,
                (learner_id, hourly_limit),
            )
            row = cur.fetchone()
        conn.commit()
    return row[0] if row else None


def get_mastery(learner_id: str, concept_id: str) -> Optional[dict]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT attempts, correct, last_seen
                FROM learner_mastery
                WHERE learner_id = %s AND concept_id = %s;
                """,
                (learner_id, concept_id),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {"attempts": row[0], "correct": row[1], "last_seen": row[2]}


def list_mastery(learner_id: str) -> dict[str, dict]:
    """Return all saved concept progress for one learner, keyed by concept id."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT concept_id, attempts, correct, last_seen
                FROM learner_mastery
                WHERE learner_id = %s
                ORDER BY last_seen DESC;
                """,
                (learner_id,),
            )
            rows = cur.fetchall()
    return {
        row[0]: {"attempts": row[1], "correct": row[2], "last_seen": row[3]}
        for row in rows
    }


def get_cached_learning_content(
    concept_id: str,
    content_type: str,
    difficulty: str,
    source_hash: str,
) -> Optional[dict]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT payload
                FROM learning_content_cache
                WHERE concept_id = %s AND content_type = %s
                  AND difficulty = %s AND source_hash = %s;
                """,
                (concept_id, content_type, difficulty, source_hash),
            )
            row = cur.fetchone()
    return row[0] if row else None


def cache_learning_content(
    concept_id: str,
    content_type: str,
    difficulty: str,
    source_hash: str,
    payload: dict,
) -> None:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO learning_content_cache
                    (concept_id, content_type, difficulty, source_hash, payload)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (concept_id, content_type, difficulty, source_hash)
                DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
                """,
                (concept_id, content_type, difficulty, source_hash, Jsonb(payload)),
            )
        conn.commit()


def save_quiz_session(
    quiz_id: str,
    learner_id: str,
    concept_id: str,
    difficulty: str,
    questions: list[dict[str, Any]],
) -> None:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO quiz_sessions (id, learner_id, concept_id, difficulty, questions)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (quiz_id, learner_id, concept_id, difficulty, Jsonb(questions)),
            )
        conn.commit()


def grade_quiz_session(quiz_id: str, learner_id: str, answers: list[int]) -> dict:
    """Grade once and update mastery in the same transaction."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT concept_id, questions, graded_at
                FROM quiz_sessions
                WHERE id = %s AND learner_id = %s
                FOR UPDATE;
                """,
                (quiz_id, learner_id),
            )
            row = cur.fetchone()
            if not row:
                raise KeyError("Quiz session was not found")
            concept_id, questions, graded_at = row
            if graded_at is not None:
                raise ValueError("This quiz has already been graded")
            if len(answers) != len(questions):
                raise ValueError("Submit one answer for every question")

            results = []
            correct_count = 0
            for index, (question, selected_index) in enumerate(zip(questions, answers)):
                if selected_index < 0 or selected_index >= len(question["options"]):
                    raise ValueError(f"Answer {index + 1} is outside the option list")
                is_correct = selected_index == question["answer_index"]
                correct_count += int(is_correct)
                results.append(
                    {
                        "id": str(index),
                        "selected_index": selected_index,
                        "correct_index": question["answer_index"],
                        "is_correct": is_correct,
                        "explanation": question["explanation"],
                    }
                )

            cur.execute(
                """
                UPDATE quiz_sessions
                SET graded_at = NOW(), score = %s
                WHERE id = %s;
                """,
                (correct_count, quiz_id),
            )
            cur.execute(
                """
                INSERT INTO learner_mastery (learner_id, concept_id, attempts, correct)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (learner_id, concept_id)
                DO UPDATE SET
                    attempts = learner_mastery.attempts + EXCLUDED.attempts,
                    correct = learner_mastery.correct + EXCLUDED.correct,
                    last_seen = NOW()
                RETURNING attempts, correct, last_seen;
                """,
                (learner_id, concept_id, len(questions), correct_count),
            )
            mastery_row = cur.fetchone()
        conn.commit()
    return {
        "concept_id": concept_id,
        "correct": correct_count,
        "total": len(questions),
        "results": results,
        "mastery": {
            "attempts": mastery_row[0],
            "correct": mastery_row[1],
            "last_seen": mastery_row[2],
        },
    }


def upsert_user(auth0_sub: str, email: Optional[str], default_role: str) -> str:
    with get_pool().connection() as conn:
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
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT role FROM app_users WHERE auth0_sub = %s", (auth0_sub,))
            row = cur.fetchone()
            return row[0] if row else None


def set_user_role(auth0_sub: str, email: Optional[str], role: str) -> str:
    with get_pool().connection() as conn:
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


def set_role_by_email(email: str, role: str) -> Optional[str]:
    """
    Update the role for an existing user looked up by email (the only identifier an
    admin has for someone who hasn't shared their auth0_sub). Returns the new role,
    or None if no user with that email has ever logged in yet.
    """
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE app_users SET role = %s WHERE email = %s RETURNING role;",
                (role, email),
            )
            row = cur.fetchone()
        conn.commit()
        return row[0] if row else None


def list_users() -> list[dict]:
    with get_pool().connection() as conn:
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
