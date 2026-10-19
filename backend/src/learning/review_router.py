"""FastAPI routes for spaced review and lesson position."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from src.auth import get_learner
from src.learning.graph import get_concept, get_learning_graph
from src.learning.review import card_status
from src.learning.review_models import (
    LessonProgressRequest,
    ReviewGradeRequest,
    ReviewGradeResponse,
    ReviewQueue,
)
from src.learning.review_service import find_card, load_review_queue
from src.learning.review_store import record_grade, save_lesson_progress
from src.learning.router import _learner_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/learning", tags=["learning"])

MAX_QUEUE_LIMIT = 100


@router.get("/review/queue", response_model=ReviewQueue)
async def review_queue(
    concept_id: Optional[str] = Query(default=None, min_length=1),
    limit: int = Query(default=20, ge=1, le=MAX_QUEUE_LIMIT),
    learner: dict = Depends(get_learner),
):
    """Cards due now (oldest first), then new cards from lessons already opened."""
    learner_id = _learner_id(learner)
    try:
        return await load_review_queue(learner_id, concept_id, limit, role=learner.get("role"))
    except Exception as exc:
        logger.exception("Could not load the review queue")
        raise HTTPException(status_code=503, detail="Your review queue is unavailable") from exc


@router.post("/review/grade", response_model=ReviewGradeResponse)
async def review_grade(request: ReviewGradeRequest, learner: dict = Depends(get_learner)):
    """Record how well the learner knew a card and schedule its next review."""
    learner_id = _learner_id(learner)
    try:
        card = await find_card(request.card_id, role=learner.get("role"))
    except Exception as exc:
        logger.exception("Could not look up review card %r", request.card_id)
        raise HTTPException(status_code=503, detail="Review is temporarily unavailable") from exc
    if card is None:
        raise HTTPException(
            status_code=404,
            detail="That review card does not exist, or its lesson has not been opened yet",
        )

    try:
        state = await asyncio.to_thread(
            record_grade,
            learner_id,
            card.card_id,
            card.concept_id,
            request.grade,
            datetime.now(timezone.utc),
        )
    except Exception as exc:
        logger.exception("Could not save a review grade")
        raise HTTPException(status_code=503, detail="Your grade could not be saved") from exc

    return ReviewGradeResponse(
        card_id=card.card_id,
        due_at=state.due_at,
        interval_seconds=state.interval_seconds,
        state=card_status(state),
    )


@router.put("/lesson/{concept_id}/progress", status_code=status.HTTP_204_NO_CONTENT)
async def lesson_progress(
    concept_id: str,
    request: LessonProgressRequest,
    learner: dict = Depends(get_learner),
):
    """Remember which beat of a lesson the learner is on, so Home can resume it."""
    learner_id = _learner_id(learner)
    try:
        concept = await asyncio.to_thread(get_concept, get_learning_graph(), concept_id)
    except Exception as exc:
        logger.exception("Could not look up concept %r", concept_id)
        raise HTTPException(status_code=503, detail="The knowledge graph is unavailable") from exc
    if concept is None:
        raise HTTPException(status_code=404, detail="Concept was not found in completed course material")

    try:
        await asyncio.to_thread(
            save_lesson_progress, learner_id, concept_id, request.beat_index, request.beat_count
        )
    except Exception as exc:
        logger.exception("Could not save lesson progress")
        raise HTTPException(status_code=503, detail="Your lesson position could not be saved") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
