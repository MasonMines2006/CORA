"""Assemble source-grounded review cards for the current published material."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from pydantic import ValidationError

from src.learning.flashcards import ConceptCards, Flashcard, build_cards, build_queue, parse_card_id
from src.learning.generation import generate_flashcards
from src.learning.graph import get_concept, get_learning_graph, get_source_context
from src.learning.models import GeneratedFlashcards
from src.learning.review_models import LastLesson, ReviewQueue, ReviewSummary
from src.learning.review_store import get_last_lesson, list_card_states, list_touched_concepts
from src.user_store import cache_learning_content, get_cached_learning_content

logger = logging.getLogger(__name__)

NEW_CARDS_PER_REQUEST = 10
MAX_NEW_DECKS_PER_REQUEST = 3


async def _load_concept_cards(graph, concept_id: str, generate_missing: bool) -> Optional[ConceptCards]:
    """One concept's current deck, generating it on first review if requested."""
    context, sources, source_hash = await asyncio.to_thread(get_source_context, graph, concept_id)
    if not context:
        return None
    concept = await asyncio.to_thread(get_concept, graph, concept_id)
    if concept is None:
        return None
    payload = await asyncio.to_thread(get_cached_learning_content, concept_id, "cards", "", source_hash)
    try:
        deck = GeneratedFlashcards.model_validate(payload) if payload is not None else None
    except ValidationError:
        logger.exception("Cached deck for %r is unreadable; regenerating", concept_id)
        deck = None
    if deck is None:
        if not generate_missing:
            return None
        deck = await generate_flashcards(concept.name, context, sources)
        await asyncio.to_thread(
            cache_learning_content, concept_id, "cards", "", source_hash, deck.model_dump()
        )
    return ConceptCards(
        concept_id=concept_id,
        concept_name=concept.name,
        cards=tuple(build_cards(concept_id, concept.name, deck, source_hash)),
    )


async def load_concept_cards(concept_ids: list[str], generate_missing: bool = False) -> list[ConceptCards]:
    """Current decks in concept order; cap new LLM work per request."""
    graph = get_learning_graph()
    results = await asyncio.gather(*(
        _load_concept_cards(graph, concept_id, False) for concept_id in concept_ids
    ))
    if generate_missing:
        missing = [index for index, result in enumerate(results) if result is None][:MAX_NEW_DECKS_PER_REQUEST]
        generated = await asyncio.gather(*(
            _load_concept_cards(graph, concept_ids[index], True) for index in missing
        ))
        for index, deck in zip(missing, generated):
            results[index] = deck
    return [result for result in results if result is not None]


async def load_review_queue(
    learner_id: str,
    concept_id: Optional[str] = None,
    limit: int = 20,
    generate_missing: bool = True,
) -> ReviewQueue:
    """Due cards then new ones -- across touched concepts, or for one concept."""
    now = datetime.now(timezone.utc)
    if concept_id is None:
        concept_ids, states = await asyncio.gather(
            asyncio.to_thread(list_touched_concepts, learner_id),
            asyncio.to_thread(list_card_states, learner_id),
        )
    else:
        concept_ids = [concept_id]
        states = await asyncio.to_thread(list_card_states, learner_id)
    concepts = await load_concept_cards(concept_ids, generate_missing=generate_missing)
    return build_queue(concepts, states, now, limit=limit, new_limit=NEW_CARDS_PER_REQUEST)


async def load_review_summary(learner_id: str) -> ReviewSummary:
    """The counts Home shows. Same code path as the queue, so they always agree."""
    queue = await load_review_queue(learner_id, limit=0, generate_missing=False)
    return ReviewSummary(due_count=queue.due_count, new_count=queue.new_count)


async def find_card(card_id: str) -> Optional[Flashcard]:
    """The card behind an id, or None if its concept has no current lesson."""
    parsed = parse_card_id(card_id)
    if parsed is None:
        return None
    concept_id, _, _ = parsed
    concepts = await load_concept_cards([concept_id])
    cards = concepts[0].cards if concepts else ()
    return next((card for card in cards if card.card_id == card_id), None)


async def load_last_lesson(learner_id: str) -> Optional[LastLesson]:
    """Where to resume, or None if there is nothing (still) resumable."""
    row = await asyncio.to_thread(get_last_lesson, learner_id)
    if row is None:
        return None
    concept = await asyncio.to_thread(get_concept, get_learning_graph(), row["concept_id"])
    if concept is None:
        # The concept left the course graph; offering to resume it would 404.
        return None
    return LastLesson(concept_name=concept.name, **row)
