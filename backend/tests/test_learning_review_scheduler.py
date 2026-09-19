"""The spaced-review scheduler: what each grade button does to a card.

The Flashcards artboard (docs/artboards/README.md section 4) prints the next
interval under every grade button, so these numbers are user-facing. The
scheduler is pure -- no clock, no database -- so every rule is pinned here.
"""

import unittest
from datetime import datetime, timedelta, timezone

from src.learning.review import (
    DAY,
    DEFAULT_EASE,
    MAX_INTERVAL_SECONDS,
    MIN_EASE,
    RELEARN_INTERVAL_SECONDS,
    CardState,
    card_status,
    preview_intervals,
    schedule,
)

NOW = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)


def seen_card(interval_days: float, reps: int, ease: float = DEFAULT_EASE, lapses: int = 0) -> CardState:
    """A card that has been recalled `reps` times in a row."""
    return CardState(
        ease=ease,
        interval_seconds=round(interval_days * DAY),
        reps=reps,
        lapses=lapses,
        due_at=NOW,
        last_reviewed_at=NOW - timedelta(days=interval_days),
    )


class NewCardTests(unittest.TestCase):
    def test_a_default_card_is_new_with_the_default_ease(self):
        card = CardState()

        self.assertEqual(card.ease, 2.5)
        self.assertEqual(card.reps, 0)
        self.assertIsNone(card.due_at)
        self.assertEqual(card_status(card), "new")

    def test_no_saved_state_also_reads_as_new(self):
        self.assertEqual(card_status(None), "new")

    def test_new_card_intervals_match_the_grade_buttons(self):
        self.assertEqual(
            preview_intervals(CardState(), NOW),
            {"again": 60, "hard": DAY, "good": DAY, "easy": 4 * DAY},
        )

    def test_again_on_a_new_card_is_not_a_lapse(self):
        # You cannot forget something you never knew.
        card = schedule(CardState(), "again", NOW)

        self.assertEqual(card.interval_seconds, RELEARN_INTERVAL_SECONDS)
        self.assertEqual(card.lapses, 0)
        self.assertEqual(card.reps, 0)
        self.assertEqual(card_status(card), "learning")

    def test_good_on_a_new_card_schedules_tomorrow(self):
        card = schedule(CardState(), "good", NOW)

        self.assertEqual(card.interval_seconds, DAY)
        self.assertEqual(card.reps, 1)
        self.assertEqual(card.due_at, NOW + timedelta(days=1))
        self.assertEqual(card.last_reviewed_at, NOW)
        self.assertEqual(card_status(card), "review")

    def test_hard_and_good_share_an_interval_but_hard_lowers_ease(self):
        hard = schedule(CardState(), "hard", NOW)
        good = schedule(CardState(), "good", NOW)

        self.assertEqual(hard.interval_seconds, good.interval_seconds)
        self.assertAlmostEqual(hard.ease, 2.35)
        self.assertAlmostEqual(good.ease, 2.5)

    def test_easy_on_a_new_card_skips_ahead_and_raises_ease(self):
        card = schedule(CardState(), "easy", NOW)

        self.assertEqual(card.interval_seconds, 4 * DAY)
        self.assertAlmostEqual(card.ease, 2.65)


class SeenCardTests(unittest.TestCase):
    def test_second_good_review_waits_three_days(self):
        # 1 day x 2.5 ease would be 2.5 days; the floor lifts the second step
        # to 3 days, the classic SM-2 shape (1 day, then a few days).
        card = schedule(seen_card(1, reps=1), "good", NOW)

        self.assertEqual(card.interval_seconds, 3 * DAY)
        self.assertEqual(card.reps, 2)

    def test_later_good_reviews_multiply_by_ease(self):
        card = schedule(seen_card(10, reps=3, ease=2.5), "good", NOW)

        self.assertEqual(card.interval_seconds, 25 * DAY)
        self.assertAlmostEqual(card.ease, 2.5)

    def test_hard_grows_the_interval_slightly_and_lowers_ease(self):
        card = schedule(seen_card(10, reps=3), "hard", NOW)

        self.assertEqual(card.interval_seconds, 12 * DAY)
        self.assertAlmostEqual(card.ease, 2.35)
        self.assertEqual(card.reps, 4)

    def test_hard_never_drops_below_one_day(self):
        card = schedule(seen_card(0.5, reps=1), "hard", NOW)

        self.assertEqual(card.interval_seconds, DAY)

    def test_easy_is_good_with_a_bonus_and_raises_ease(self):
        card = schedule(seen_card(10, reps=3, ease=2.5), "easy", NOW)

        self.assertEqual(card.interval_seconds, round(10 * 2.5 * 1.3 * DAY))
        self.assertAlmostEqual(card.ease, 2.65)

    def test_again_on_a_known_card_is_a_lapse(self):
        card = schedule(seen_card(10, reps=3, lapses=1), "again", NOW)

        self.assertEqual(card.interval_seconds, RELEARN_INTERVAL_SECONDS)
        self.assertEqual(card.reps, 0)
        self.assertEqual(card.lapses, 2)
        self.assertAlmostEqual(card.ease, 2.3)
        self.assertEqual(card.due_at, NOW + timedelta(seconds=60))
        self.assertEqual(card_status(card), "learning")

    def test_a_relearned_card_graduates_back_to_one_day(self):
        lapsed = schedule(seen_card(10, reps=3), "again", NOW)

        card = schedule(lapsed, "good", NOW + timedelta(minutes=2))

        self.assertEqual(card.interval_seconds, DAY)
        self.assertEqual(card.reps, 1)

    def test_ease_never_falls_below_the_floor(self):
        card = seen_card(10, reps=3, ease=MIN_EASE + 0.05)

        for grade in ("again", "hard", "again"):
            card = schedule(card, grade, NOW)

        self.assertAlmostEqual(card.ease, MIN_EASE)

    def test_intervals_are_capped(self):
        card = schedule(seen_card(300, reps=9, ease=3.0), "easy", NOW)

        self.assertEqual(card.interval_seconds, MAX_INTERVAL_SECONDS)

    def test_many_easy_grades_never_overflow(self):
        # Uncapped, ~16 Easy grades in a row would overflow timedelta.
        card = CardState()
        for _ in range(60):
            card = schedule(card, "easy", NOW)

        self.assertEqual(card.interval_seconds, MAX_INTERVAL_SECONDS)


class PreviewTests(unittest.TestCase):
    def test_preview_matches_what_each_grade_would_schedule(self):
        card = seen_card(4, reps=2, ease=2.2)

        preview = preview_intervals(card, NOW)

        for grade in ("again", "hard", "good", "easy"):
            with self.subTest(grade=grade):
                self.assertEqual(preview[grade], schedule(card, grade, NOW).interval_seconds)

    def test_buttons_are_ordered_from_soonest_to_latest(self):
        # The four buttons read left to right as "sooner" to "later"; a lower
        # ease must never let Easy land before Good.
        for ease in (MIN_EASE, 2.0, DEFAULT_EASE, 3.2):
            for reps, interval_days in ((0, 0), (1, 1), (1, 4), (4, 30)):
                with self.subTest(ease=ease, reps=reps, interval_days=interval_days):
                    preview = preview_intervals(seen_card(interval_days, reps, ease), NOW)
                    self.assertLessEqual(preview["again"], preview["hard"])
                    self.assertLessEqual(preview["hard"], preview["good"])
                    self.assertLessEqual(preview["good"], preview["easy"])

    def test_scheduling_does_not_mutate_the_input_state(self):
        card = seen_card(10, reps=3)

        schedule(card, "again", NOW)

        self.assertEqual(card.reps, 3)
        self.assertEqual(card.interval_seconds, 10 * DAY)


class GradeValidationTests(unittest.TestCase):
    def test_unknown_grade_is_rejected(self):
        with self.assertRaises(ValueError):
            schedule(CardState(), "perfect", NOW)


if __name__ == "__main__":
    unittest.main()
