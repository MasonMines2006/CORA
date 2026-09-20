"""Turn a generated, source-grounded deck into scheduled review cards."""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from src.learning.models import GeneratedFlashcards
from src.learning.review import CardState, card_status, preview_intervals
from src.learning.review_models import ReviewCard, ReviewIntervals, ReviewQueue

CARD_ID_SEPARATOR = "::"


@dataclass(frozen=True)
class Flashcard:
    card_id: str
    concept_id: str
    key: str
    prompt: str
    answer: str
    source: str


@dataclass(frozen=True)
class ConceptCards:
    """Every card one concept's cached lesson yields."""

    concept_id: str
    concept_name: str
    cards: tuple[Flashcard, ...]


def make_card_id(concept_id: str, source_hash: str, index: int) -> str:
    return f"{concept_id}{CARD_ID_SEPARATOR}{source_hash[:16]}{CARD_ID_SEPARATOR}{index}"


def parse_card_id(card_id: str) -> Optional[tuple[str, str, int]]:
    """Decode a versioned card id; the concept id itself may contain '::'."""
    prefix, separator, index_text = card_id.rpartition(CARD_ID_SEPARATOR)
    concept_id, version_separator, version = prefix.rpartition(CARD_ID_SEPARATOR)
    if (not separator or not version_separator or not concept_id
            or len(version) != 16 or any(ch not in "0123456789abcdef" for ch in version)
            or not index_text.isdecimal()):
        return None
    return concept_id, version, int(index_text)


def build_cards(
    concept_id: str,
    concept_name: str,
    deck: GeneratedFlashcards,
    source_hash: str,
) -> list[Flashcard]:
    """Keep card IDs stable until their published source version changes."""
    return [
        Flashcard(
            card_id=make_card_id(concept_id, source_hash, index),
            concept_id=concept_id,
            key=str(index),
            prompt=card.question,
            answer=card.answer,
            source=card.source,
        )
        for index, card in enumerate(deck.cards)
    ]


def _review_card(concept: ConceptCards, card: Flashcard, state: Optional[CardState], now: datetime) -> ReviewCard:
    return ReviewCard(
        card_id=card.card_id,
        concept_id=card.concept_id,
        concept_name=concept.concept_name,
        prompt=card.prompt,
        answer=card.answer,
        source=card.source,
        state=card_status(state),
        last_reviewed_at=state.last_reviewed_at if state else None,
        due_at=state.due_at if state else None,
        intervals=ReviewIntervals(**preview_intervals(state or CardState(), now)),
    )


def build_queue(
    concepts: list[ConceptCards],
    states: dict[str, CardState],
    now: datetime,
    limit: int,
    new_limit: int,
) -> ReviewQueue:
    """Due cards first (oldest due first), then never-graded cards.

    `concepts` is in priority order: new cards are taken concept by concept.
    Schedules for cards not in `concepts` are ignored -- if a lesson is no
    longer cached, its cards cannot be shown, so they are not counted either.
    """
    due: list[tuple[datetime, ReviewCard]] = []
    new: list[ReviewCard] = []
    for concept in concepts:
        for card in concept.cards:
            state = states.get(card.card_id)
            if card_status(state) == "new":
                new.append(_review_card(concept, card, None, now))
            elif state.due_at is not None and state.due_at <= now:
                due.append((state.due_at, _review_card(concept, card, state, now)))

    # sorted() is stable, so equal due times keep concept and beat order.
    due_cards = [card for _, card in sorted(due, key=lambda item: item[0])]
    selected = due_cards[:limit]
    new_slots = max(0, min(new_limit, limit - len(selected)))
    return ReviewQueue(
        due_count=len(due_cards),
        new_count=len(new),
        cards=selected + new[:new_slots],
    )
