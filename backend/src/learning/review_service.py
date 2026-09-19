"""Assemble a learner's review queue from the graph, the lesson cache and the store.

Cards exist only for lessons already in `learning_content_cache` under the
concept's CURRENT source hash -- the same key the lesson endpoint uses -- so
review always matches the lesson the student would see today. Nothing here
calls the LLM.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from pydantic import ValidationError

from src.learning.flashcards import ConceptCards, Flashcard, build_cards, build_queue, parse_card_id
from src.learning.graph import get_concept, get_learning_graph, get_source_context
from src.learning.models import GeneratedLesson
from src.learning.review_models import LastLesson, ReviewQueue, ReviewSummary
from src.learning.review_store import get_last_lesson, list_card_states, list_touched_concepts
from src.user_store import get_cached_learning_content

logger = logging.getLogger(__name__)

# Each lesson yields four cards, so this introduces two or three concepts'
# worth of new material per session -- enough to make progress without
# burying the cards that are actually due.
NEW_CARDS_PER_REQUEST = 10


def _load_concept_cards_sync(graph, concept_id: str) -> Optional[ConceptCards]:
    """One concept's cards, or None if it has no current cached lesson."""
    context, sources, source_hash = get_source_context(graph, concept_id)
    if not context:
        return None
    payload = get_cached_learning_content(concept_id, "lesson", "", source_hash)
    if payload is None:
        return None
    concept = get_concept(graph, concept_id)
    if concept is None:
        return None
    try:
        lesson = GeneratedLesson.model_validate(payload)
    except ValidationError:
        # One unreadable cache row must not take the whole queue down.
        logger.exception("Cached lesson for %r is unreadable; its review cards are skipped", concept_id)
        return None
    return ConceptCards(
        concept_id=concept_id,
        concept_name=concept.name,
        cards=tuple(build_cards(concept_id, concept.name, lesson, sources)),
    )


async def load_concept_cards(concept_ids: list[str]) -> list[ConceptCards]:
    """Cards for each concept that has them, in the order given."""
    graph = get_learning_graph()
    results = await asyncio.gather(
        *(asyncio.to_thread(_load_concept_cards_sync, graph, concept_id) for concept_id in concept_ids)
    )
    return [result for result in results if result is not None]


async def load_review_queue(
    learner_id: str,
    concept_id: Optional[str] = None,
    limit: int = 20,
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
    concepts = await load_concept_cards(concept_ids)
    return build_queue(concepts, states, now, limit=limit, new_limit=NEW_CARDS_PER_REQUEST)


async def load_review_summary(learner_id: str) -> ReviewSummary:
    """The counts Home shows. Same code path as the queue, so they always agree."""
    queue = await load_review_queue(learner_id, limit=0)
    return ReviewSummary(due_count=queue.due_count, new_count=queue.new_count)


async def find_card(card_id: str) -> Optional[Flashcard]:
    """The card behind an id, or None if its concept has no current lesson."""
    parsed = parse_card_id(card_id)
    if parsed is None:
        return None
    concept_id, _ = parsed
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
