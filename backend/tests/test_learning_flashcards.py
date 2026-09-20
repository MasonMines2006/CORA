"""Generated decks keep provenance and invalidate schedules when sources change."""

import unittest
from datetime import datetime, timedelta, timezone

from src.learning.flashcards import ConceptCards, build_cards, build_queue, make_card_id, parse_card_id
from src.learning.models import GeneratedFlashcard, GeneratedFlashcards
from src.learning.review import DAY, CardState, schedule

NOW = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)
HASH = 'abcdef0123456789' * 4
OTHER_HASH = '1234567890abcdef' * 4


def deck(count=4):
    return GeneratedFlashcards(cards=[
        GeneratedFlashcard(question=f'Question {index}?', answer=f'Answer {index}.', source='Source.pdf')
        for index in range(count)
    ])


def concept_cards(concept_id='Concept', count=4, source_hash=HASH):
    return ConceptCards(
        concept_id=concept_id,
        concept_name=concept_id,
        cards=tuple(build_cards(concept_id, concept_id, deck(count), source_hash)),
    )


class CardIdTests(unittest.TestCase):
    def test_card_id_round_trips_even_if_concept_contains_separator(self):
        card_id = make_card_id('A::B', HASH, 2)
        self.assertEqual(card_id, 'A::B::abcdef0123456789::2')
        self.assertEqual(parse_card_id(card_id), ('A::B', 'abcdef0123456789', 2))

    def test_malformed_or_old_ids_are_rejected(self):
        for card_id in ('Concept::core_idea', 'Concept::bad::0', '::abcdef0123456789::0', 'Concept::abcdef0123456789::no'):
            with self.subTest(card_id=card_id):
                self.assertIsNone(parse_card_id(card_id))

    def test_source_revision_changes_card_identity(self):
        self.assertNotEqual(make_card_id('Concept', HASH, 0), make_card_id('Concept', OTHER_HASH, 0))


class BuildCardsTests(unittest.TestCase):
    def test_questions_and_count_come_from_generated_deck(self):
        cards = build_cards('Concept', 'Concept', deck(5), HASH)
        self.assertEqual(len(cards), 5)
        self.assertEqual(cards[0].prompt, 'Question 0?')
        self.assertEqual(cards[0].answer, 'Answer 0.')
        self.assertEqual(cards[0].source, 'Source.pdf')
        self.assertEqual(cards[4].card_id, make_card_id('Concept', HASH, 4))


class BuildQueueTests(unittest.TestCase):
    def test_new_cards_are_bounded_and_counted(self):
        concepts = [concept_cards('First'), concept_cards('Second'), concept_cards('Third')]
        queue = build_queue(concepts, {}, NOW, limit=20, new_limit=10)
        self.assertEqual(queue.new_count, 12)
        self.assertEqual(len(queue.cards), 10)
        self.assertEqual(queue.cards[0].concept_id, 'First')
        self.assertEqual(queue.cards[4].concept_id, 'Second')

    def test_due_cards_lead_and_future_cards_are_hidden(self):
        first_id = make_card_id('Concept', HASH, 0)
        second_id = make_card_id('Concept', HASH, 1)
        states = {
            first_id: schedule(CardState(), 'good', NOW - timedelta(days=3)),
            second_id: schedule(CardState(), 'good', NOW),
        }
        queue = build_queue([concept_cards()], states, NOW, limit=20, new_limit=10)
        self.assertEqual(queue.due_count, 1)
        self.assertEqual(queue.new_count, 2)
        self.assertEqual(queue.cards[0].card_id, first_id)
        self.assertEqual(queue.cards[0].state, 'review')
        self.assertEqual(queue.cards[0].intervals.good, 3 * DAY)
        self.assertNotIn(second_id, [card.card_id for card in queue.cards])

    def test_old_revision_schedules_do_not_apply_to_new_deck(self):
        old_id = make_card_id('Concept', HASH, 0)
        states = {old_id: schedule(CardState(), 'good', NOW - timedelta(days=3))}
        queue = build_queue([concept_cards(source_hash=OTHER_HASH)], states, NOW, limit=20, new_limit=10)
        self.assertEqual(queue.due_count, 0)
        self.assertEqual(queue.new_count, 4)
        self.assertNotIn(old_id, [card.card_id for card in queue.cards])

    def test_empty_queue_is_valid(self):
        queue = build_queue([], {}, NOW, limit=20, new_limit=10)
        self.assertEqual((queue.due_count, queue.new_count, queue.cards), (0, 0, []))


if __name__ == '__main__':
    unittest.main()
