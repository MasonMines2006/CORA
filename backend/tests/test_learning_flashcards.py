"""Review cards are built from the cached lesson, and the queue orders them.

The cards must match what the frontend showed before scheduling existed
(`lessonCards()` in frontend/src/components/Student/StudentStudyTools.tsx), so a
student reviewing on the server-built queue sees the same four prompts.
"""

import unittest
from datetime import datetime, timedelta, timezone

from src.learning.flashcards import (
    CARD_KEYS,
    ConceptCards,
    build_cards,
    build_queue,
    make_card_id,
    parse_card_id,
)
from src.learning.models import GeneratedLesson, QuickCheck
from src.learning.review import DAY, CardState, schedule

NOW = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)

SOURCES = [
    "Theory Manual - NE235.pdf",
    "PULSTAR Technical Specifications (Updated 07_31_2023).pdf",
]


def lesson(**overrides) -> GeneratedLesson:
    fields = {
        "core_idea": "Reactivity measures departure from criticality.",
        "how_it_works": "rho = (k - 1) / k.",
        "pulstar_application": "PULSTAR tracks reactivity with control rod worth.",
        "quick_check": QuickCheck(
            question="What is reactivity at exact criticality?",
            options=["Negative", "Zero", "Positive"],
            answer_index=1,
            explanation="k equals 1, so rho is 0",
        ),
    }
    fields.update(overrides)
    return GeneratedLesson(**fields)


def concept_cards(concept_id: str, name: str | None = None) -> ConceptCards:
    name = name or concept_id
    return ConceptCards(
        concept_id=concept_id,
        concept_name=name,
        cards=tuple(build_cards(concept_id, name, lesson(), SOURCES)),
    )


class CardIdTests(unittest.TestCase):
    def test_card_id_joins_concept_and_beat(self):
        self.assertEqual(make_card_id("Reactivity", "core_idea"), "Reactivity::core_idea")

    def test_card_id_round_trips(self):
        for key in CARD_KEYS:
            with self.subTest(key=key):
                self.assertEqual(parse_card_id(make_card_id("Reactor Period", key)), ("Reactor Period", key))

    def test_concept_ids_containing_the_separator_still_parse(self):
        self.assertEqual(parse_card_id("a::b::quick_check"), ("a::b", "quick_check"))

    def test_malformed_card_ids_do_not_parse(self):
        for card_id in ("Reactivity", "Reactivity::summary", "::core_idea", "Reactivity::"):
            with self.subTest(card_id=card_id):
                self.assertIsNone(parse_card_id(card_id))


class BuildCardsTests(unittest.TestCase):
    def test_four_cards_mirror_the_frontend_prompts(self):
        cards = build_cards("Reactivity", "Reactivity", lesson(), SOURCES)

        self.assertEqual([card.key for card in cards], list(CARD_KEYS))
        self.assertEqual(
            [card.prompt for card in cards],
            [
                "What is the core idea behind Reactivity?",
                "How does Reactivity work?",
                "How is Reactivity used at PULSTAR?",
                "What is reactivity at exact criticality?",
            ],
        )
        self.assertEqual(cards[0].answer, "Reactivity measures departure from criticality.")
        self.assertEqual(cards[0].card_id, "Reactivity::core_idea")
        self.assertEqual(cards[0].concept_id, "Reactivity")

    def test_quick_check_answer_is_the_correct_option_and_explanation(self):
        card = build_cards("Reactivity", "Reactivity", lesson(), SOURCES)[3]

        self.assertEqual(card.answer, "Zero. k equals 1, so rho is 0")

    def test_pulstar_card_cites_a_pulstar_source(self):
        cards = build_cards("Reactivity", "Reactivity", lesson(), SOURCES)

        self.assertEqual(cards[0].source, "Theory Manual - NE235.pdf")
        self.assertEqual(cards[2].source, "PULSTAR Technical Specifications (Updated 07_31_2023).pdf")

    def test_pulstar_card_falls_back_to_the_first_source(self):
        cards = build_cards("Reactivity", "Reactivity", lesson(), ["Theory Manual - NE235.pdf"])

        self.assertEqual(cards[2].source, "Theory Manual - NE235.pdf")

    def test_no_sources_reads_as_course_material(self):
        cards = build_cards("Reactivity", "Reactivity", lesson(), [])

        self.assertTrue(all(card.source == "Course material" for card in cards))

    def test_cards_with_no_answer_are_dropped(self):
        # The frontend filters these out too: a card with a blank back is useless.
        cards = build_cards("Reactivity", "Reactivity", lesson(pulstar_application="  "), SOURCES)

        self.assertNotIn("pulstar_application", [card.key for card in cards])
        self.assertEqual(len(cards), 3)

    def test_out_of_range_quick_check_answer_keeps_the_explanation(self):
        broken = lesson(
            quick_check=QuickCheck(question="Q?", options=["A"], answer_index=4, explanation="Because.")
        )

        card = build_cards("Reactivity", "Reactivity", broken, SOURCES)[3]

        self.assertEqual(card.answer, "Because.")


class BuildQueueTests(unittest.TestCase):
    def test_a_new_learner_gets_new_cards_with_first_step_intervals(self):
        queue = build_queue([concept_cards("Reactivity")], {}, NOW, limit=20, new_limit=10)

        self.assertEqual(queue.due_count, 0)
        self.assertEqual(queue.new_count, 4)
        first = queue.cards[0]
        self.assertEqual(first.card_id, "Reactivity::core_idea")
        self.assertEqual(first.concept_name, "Reactivity")
        self.assertEqual(first.state, "new")
        self.assertIsNone(first.due_at)
        self.assertIsNone(first.last_reviewed_at)
        self.assertEqual(
            first.intervals.model_dump(),
            {"again": 60, "hard": DAY, "good": DAY, "easy": 4 * DAY},
        )

    def test_due_cards_come_first_oldest_due_first(self):
        states = {
            "Reactivity::how_it_works": schedule(CardState(), "good", NOW - timedelta(days=2)),
            "Reactivity::core_idea": schedule(CardState(), "good", NOW - timedelta(days=3)),
        }

        queue = build_queue([concept_cards("Reactivity")], states, NOW, limit=20, new_limit=10)

        self.assertEqual(queue.due_count, 2)
        self.assertEqual(queue.new_count, 2)
        self.assertEqual(
            [card.card_id for card in queue.cards],
            [
                "Reactivity::core_idea",
                "Reactivity::how_it_works",
                "Reactivity::pulstar_application",
                "Reactivity::quick_check",
            ],
        )
        self.assertEqual(queue.cards[0].state, "review")
        self.assertEqual(queue.cards[0].intervals.good, 3 * DAY)

    def test_cards_scheduled_for_later_are_left_out(self):
        states = {"Reactivity::core_idea": schedule(CardState(), "good", NOW)}

        queue = build_queue([concept_cards("Reactivity")], states, NOW, limit=20, new_limit=10)

        self.assertEqual(queue.due_count, 0)
        self.assertEqual(queue.new_count, 3)
        self.assertNotIn("Reactivity::core_idea", [card.card_id for card in queue.cards])

    def test_a_missed_card_is_due_again_after_a_minute(self):
        states = {"Reactivity::core_idea": schedule(CardState(), "again", NOW - timedelta(minutes=2))}

        queue = build_queue([concept_cards("Reactivity")], states, NOW, limit=20, new_limit=10)

        self.assertEqual(queue.cards[0].card_id, "Reactivity::core_idea")
        self.assertEqual(queue.cards[0].state, "learning")

    def test_new_cards_are_capped_but_counted_in_full(self):
        concepts = [concept_cards("Reactivity"), concept_cards("Reactor"), concept_cards("Xenon")]

        queue = build_queue(concepts, {}, NOW, limit=20, new_limit=10)

        self.assertEqual(queue.new_count, 12)
        self.assertEqual(len(queue.cards), 10)
        # New cards follow the order concepts were given in (most recent first).
        self.assertEqual(queue.cards[0].concept_id, "Reactivity")
        self.assertEqual(queue.cards[4].concept_id, "Reactor")

    def test_limit_applies_to_due_and_new_together(self):
        states = {
            make_card_id("Reactor", key): schedule(CardState(), "good", NOW - timedelta(days=2))
            for key in CARD_KEYS
        }

        queue = build_queue(
            [concept_cards("Reactivity"), concept_cards("Reactor")], states, NOW, limit=5, new_limit=10
        )

        self.assertEqual(queue.due_count, 4)
        self.assertEqual(queue.new_count, 4)
        self.assertEqual(len(queue.cards), 5)
        self.assertEqual([card.state for card in queue.cards], ["review"] * 4 + ["new"])

    def test_states_for_concepts_without_cards_are_ignored(self):
        # A due card whose lesson is no longer cached cannot be shown, so it is
        # not counted either -- Home must never promise a card it cannot serve.
        states = {"Gone::core_idea": schedule(CardState(), "good", NOW - timedelta(days=5))}

        queue = build_queue([concept_cards("Reactivity")], states, NOW, limit=20, new_limit=10)

        self.assertEqual(queue.due_count, 0)
        self.assertNotIn("Gone::core_idea", [card.card_id for card in queue.cards])

    def test_an_empty_queue_is_valid(self):
        queue = build_queue([], {}, NOW, limit=20, new_limit=10)

        self.assertEqual((queue.due_count, queue.new_count, queue.cards), (0, 0, []))


if __name__ == "__main__":
    unittest.main()
