"""Review schedules and lesson position, against the real Postgres.

A fake store would prove nothing about the SQL, the locking or the upserts, so
these run against the database the app uses. Every test writes under a fresh
`test:<uuid>` learner id and deletes its own rows afterwards. Skips cleanly
when no Postgres is configured.
"""

import os
import threading
import unittest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from src.learning.review import DAY, RELEARN_INTERVAL_SECONDS
from src.learning.review_store import (
    ensure_review_tables,
    get_last_lesson,
    list_card_states,
    list_touched_concepts,
    record_grade,
    save_lesson_progress,
)
from src.user_store import ensure_learning_tables, get_pool

NOW = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)


def _postgres_available() -> bool:
    if not os.environ.get("POSTGRES_USER"):
        return False
    try:
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
        return True
    except Exception:
        return False


class ReviewStoreTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not _postgres_available():
            raise unittest.SkipTest("No reachable Postgres; skipping review store checks")
        ensure_learning_tables()
        ensure_review_tables()

    def setUp(self):
        self.learner_id = f"test:{uuid4()}"
        self.other_learner_id = f"test:{uuid4()}"

    def tearDown(self):
        with get_pool().connection() as conn, conn.cursor() as cur:
            for table in ("review_cards", "lesson_progress", "learner_mastery"):
                cur.execute(
                    f"DELETE FROM {table} WHERE learner_id = ANY(%s)",
                    ([self.learner_id, self.other_learner_id],),
                )
            conn.commit()


class EnsureTablesTests(ReviewStoreTestCase):
    def test_setup_is_idempotent(self):
        ensure_review_tables()
        ensure_review_tables()

        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name IN ('review_cards', 'lesson_progress')
                """
            )
            self.assertEqual({row[0] for row in cur.fetchall()}, {"review_cards", "lesson_progress"})


class RecordGradeTests(ReviewStoreTestCase):
    def test_first_grade_creates_the_schedule(self):
        state = record_grade(self.learner_id, "Reactivity::core_idea", "Reactivity", "good", NOW)

        self.assertEqual(state.interval_seconds, DAY)
        self.assertEqual(state.reps, 1)
        self.assertEqual(state.due_at, NOW + timedelta(days=1))

        saved = list_card_states(self.learner_id)["Reactivity::core_idea"]
        self.assertEqual(saved, state)

    def test_later_grades_build_on_the_saved_schedule(self):
        record_grade(self.learner_id, "Reactivity::core_idea", "Reactivity", "good", NOW)
        state = record_grade(
            self.learner_id, "Reactivity::core_idea", "Reactivity", "good", NOW + timedelta(days=1)
        )

        self.assertEqual(state.interval_seconds, 3 * DAY)
        self.assertEqual(state.reps, 2)

    def test_a_miss_is_saved_as_a_lapse(self):
        record_grade(self.learner_id, "Reactivity::core_idea", "Reactivity", "good", NOW)
        state = record_grade(
            self.learner_id, "Reactivity::core_idea", "Reactivity", "again", NOW + timedelta(days=1)
        )

        self.assertEqual(state.interval_seconds, RELEARN_INTERVAL_SECONDS)
        self.assertEqual(state.lapses, 1)
        self.assertAlmostEqual(list_card_states(self.learner_id)["Reactivity::core_idea"].ease, 2.3)

    def test_concurrent_grades_of_one_card_are_never_lost(self):
        # Read-modify-write without a lock would let two grades both start from
        # the same state and one overwrite the other, leaving reps below 5.
        errors = []

        def grade():
            try:
                record_grade(self.learner_id, "Reactor::quick_check", "Reactor", "good", NOW)
            except Exception as exc:  # surfaced below; a thread cannot fail the test
                errors.append(exc)

        threads = [threading.Thread(target=grade) for _ in range(5)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(errors, [])
        self.assertEqual(list_card_states(self.learner_id)["Reactor::quick_check"].reps, 5)

    def test_learners_keep_separate_schedules(self):
        record_grade(self.learner_id, "Reactivity::core_idea", "Reactivity", "easy", NOW)

        self.assertEqual(list_card_states(self.other_learner_id), {})
        self.assertEqual(set(list_card_states(self.learner_id)), {"Reactivity::core_idea"})


class LessonProgressTests(ReviewStoreTestCase):
    def test_position_is_upserted_per_concept(self):
        save_lesson_progress(self.learner_id, "Reactivity", 1, 4)
        save_lesson_progress(self.learner_id, "Reactivity", 2, 4)

        last = get_last_lesson(self.learner_id)

        self.assertEqual(
            (last["concept_id"], last["beat_index"], last["beat_count"]), ("Reactivity", 2, 4)
        )
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM lesson_progress WHERE learner_id = %s", (self.learner_id,))
            self.assertEqual(cur.fetchone()[0], 1)

    def test_last_lesson_is_the_most_recently_updated(self):
        save_lesson_progress(self.learner_id, "Reactivity", 3, 4)
        save_lesson_progress(self.learner_id, "Reactor Period", 0, 4)

        self.assertEqual(get_last_lesson(self.learner_id)["concept_id"], "Reactor Period")

        save_lesson_progress(self.learner_id, "Reactivity", 3, 4)

        self.assertEqual(get_last_lesson(self.learner_id)["concept_id"], "Reactivity")

    def test_a_learner_with_no_lessons_has_no_last_lesson(self):
        self.assertIsNone(get_last_lesson(self.learner_id))

    def test_the_database_rejects_a_position_past_the_end(self):
        with self.assertRaises(Exception):
            save_lesson_progress(self.learner_id, "Reactivity", 4, 4)


class TouchedConceptTests(ReviewStoreTestCase):
    def test_touched_concepts_come_from_mastery_lessons_and_reviews_newest_first(self):
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO learner_mastery (learner_id, concept_id, attempts, correct, last_seen)
                VALUES (%s, 'Xenon', 3, 2, NOW() - INTERVAL '2 days')
                """,
                (self.learner_id,),
            )
            conn.commit()
        record_grade(
            self.learner_id,
            "Reactor::core_idea",
            "Reactor",
            "good",
            datetime.now(timezone.utc) - timedelta(days=1),
        )
        save_lesson_progress(self.learner_id, "Reactivity", 0, 4)

        self.assertEqual(list_touched_concepts(self.learner_id), ["Reactivity", "Reactor", "Xenon"])

    def test_each_concept_is_listed_once(self):
        save_lesson_progress(self.learner_id, "Reactivity", 0, 4)
        record_grade(self.learner_id, "Reactivity::core_idea", "Reactivity", "good", NOW)
        record_grade(self.learner_id, "Reactivity::quick_check", "Reactivity", "good", NOW)

        self.assertEqual(list_touched_concepts(self.learner_id), ["Reactivity"])

    def test_a_new_learner_has_touched_nothing(self):
        self.assertEqual(list_touched_concepts(self.learner_id), [])


if __name__ == "__main__":
    unittest.main()
