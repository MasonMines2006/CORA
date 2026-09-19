"""Postgres persistence for review schedules and lesson position.

Everything is keyed on `learner_id`, exactly like `learner_mastery`, so a guest
(`guest:<uuid>`) keeps their schedule the same way a signed-in student does.
The tables are additive: created if missing, never altered or dropped.
"""

from datetime import datetime, timezone
from typing import Optional

from src.learning.review import DEFAULT_EASE, CardState, schedule
from src.user_store import get_pool


def ensure_review_tables() -> None:
    """Create the review tables if needed. Call once at app startup."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS review_cards (
                    learner_id TEXT NOT NULL,
                    card_id TEXT NOT NULL,
                    concept_id TEXT NOT NULL,
                    ease DOUBLE PRECISION NOT NULL CHECK (ease > 0),
                    interval_seconds INTEGER NOT NULL DEFAULT 0 CHECK (interval_seconds >= 0),
                    reps INTEGER NOT NULL DEFAULT 0 CHECK (reps >= 0),
                    lapses INTEGER NOT NULL DEFAULT 0 CHECK (lapses >= 0),
                    -- NULL only inside record_grade's transaction, before the
                    -- first grade is written; a committed row always has both.
                    due_at TIMESTAMPTZ,
                    last_reviewed_at TIMESTAMPTZ,
                    PRIMARY KEY (learner_id, card_id)
                );

                -- Only the structural rule lives here. The product limit on
                -- beat_count is enforced by the API, so it can change without
                -- altering a constraint on an existing table.
                CREATE TABLE IF NOT EXISTS lesson_progress (
                    learner_id TEXT NOT NULL,
                    concept_id TEXT NOT NULL,
                    beat_index INTEGER NOT NULL CHECK (beat_index >= 0),
                    beat_count INTEGER NOT NULL CHECK (beat_count >= 1),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CHECK (beat_index < beat_count),
                    PRIMARY KEY (learner_id, concept_id)
                );
                """
            )
        conn.commit()


def _utc(value: Optional[datetime]) -> Optional[datetime]:
    return value.astimezone(timezone.utc) if value is not None else None


def _state_from_row(row: tuple) -> CardState:
    ease, interval_seconds, reps, lapses, due_at, last_reviewed_at = row
    return CardState(
        ease=float(ease),
        interval_seconds=int(interval_seconds),
        reps=int(reps),
        lapses=int(lapses),
        due_at=_utc(due_at),
        last_reviewed_at=_utc(last_reviewed_at),
    )


def list_card_states(learner_id: str) -> dict[str, CardState]:
    """Every card this learner has graded, keyed by card id."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT card_id, ease, interval_seconds, reps, lapses, due_at, last_reviewed_at
                FROM review_cards
                WHERE learner_id = %s AND last_reviewed_at IS NOT NULL;
                """,
                (learner_id,),
            )
            rows = cur.fetchall()
    return {row[0]: _state_from_row(row[1:]) for row in rows}


def record_grade(
    learner_id: str,
    card_id: str,
    concept_id: str,
    grade: str,
    now: datetime,
) -> CardState:
    """Apply one grade to one card atomically and return its new schedule.

    Grading is read-modify-write, so two grades arriving together (a double
    click, two tabs) could both start from the same state and one would be
    lost. To serialise them, the row is created first if missing and then
    locked with FOR UPDATE for the rest of the transaction.
    """
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            # A placeholder with no last_reviewed_at reads as a new card.
            cur.execute(
                """
                INSERT INTO review_cards (learner_id, card_id, concept_id, ease)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (learner_id, card_id) DO NOTHING;
                """,
                (learner_id, card_id, concept_id, DEFAULT_EASE),
            )
            cur.execute(
                """
                SELECT ease, interval_seconds, reps, lapses, due_at, last_reviewed_at
                FROM review_cards
                WHERE learner_id = %s AND card_id = %s
                FOR UPDATE;
                """,
                (learner_id, card_id),
            )
            updated = schedule(_state_from_row(cur.fetchone()), grade, now)
            cur.execute(
                """
                UPDATE review_cards
                SET ease = %s, interval_seconds = %s, reps = %s, lapses = %s,
                    due_at = %s, last_reviewed_at = %s
                WHERE learner_id = %s AND card_id = %s;
                """,
                (
                    updated.ease,
                    updated.interval_seconds,
                    updated.reps,
                    updated.lapses,
                    updated.due_at,
                    updated.last_reviewed_at,
                    learner_id,
                    card_id,
                ),
            )
        conn.commit()
    return updated


def save_lesson_progress(learner_id: str, concept_id: str, beat_index: int, beat_count: int) -> None:
    """Remember where the learner is in one concept's lesson (last write wins)."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO lesson_progress (learner_id, concept_id, beat_index, beat_count)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (learner_id, concept_id)
                DO UPDATE SET beat_index = EXCLUDED.beat_index,
                              beat_count = EXCLUDED.beat_count,
                              updated_at = NOW();
                """,
                (learner_id, concept_id, beat_index, beat_count),
            )
        conn.commit()


def get_last_lesson(learner_id: str) -> Optional[dict]:
    """The lesson position this learner updated most recently, if any."""
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT concept_id, beat_index, beat_count, updated_at
                FROM lesson_progress
                WHERE learner_id = %s
                ORDER BY updated_at DESC, concept_id
                LIMIT 1;
                """,
                (learner_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {
        "concept_id": row[0],
        "beat_index": row[1],
        "beat_count": row[2],
        "updated_at": _utc(row[3]),
    }


def list_touched_concepts(learner_id: str) -> list[str]:
    """Concepts the learner has worked on, most recent activity first.

    Touching means a quiz (mastery row), a lesson position, or a graded card.
    New review cards are drawn from these concepts, newest first.
    """
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT concept_id
                FROM (
                    SELECT concept_id, last_seen AS touched_at
                    FROM learner_mastery WHERE learner_id = %(learner_id)s
                    UNION ALL
                    SELECT concept_id, updated_at
                    FROM lesson_progress WHERE learner_id = %(learner_id)s
                    UNION ALL
                    SELECT concept_id, last_reviewed_at
                    FROM review_cards
                    WHERE learner_id = %(learner_id)s AND last_reviewed_at IS NOT NULL
                ) AS touched
                GROUP BY concept_id
                ORDER BY max(touched_at) DESC, concept_id;
                """,
                {"learner_id": learner_id},
            )
            rows = cur.fetchall()
    return [row[0] for row in rows]
