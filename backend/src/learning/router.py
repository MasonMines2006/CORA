"""FastAPI router for CORA guided learning and adaptive assessment."""

import asyncio
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.auth import get_learner
from src.learning.generation import generate_lesson, generate_quiz
from src.learning.graph import get_concept, get_learning_graph, get_source_context, list_concepts
from src.learning.models import (
    GeneratedLesson,
    GeneratedQuiz,
    GradedQuestion,
    LessonBeat,
    LessonResponse,
    LearningDashboard,
    Mastery,
    QuizGenerateRequest,
    QuizGradeRequest,
    QuizGradeResponse,
    QuizQuestion,
    QuizResponse,
)
from src.learning.service import build_dashboard, mastery_from_row
from src.user_store import (
    cache_learning_content,
    get_cached_learning_content,
    get_mastery,
    list_mastery,
    grade_quiz_session,
    save_quiz_session,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/learning", tags=["learning"])


def _learner_id(learner: dict) -> str:
    learner_id = learner.get("learner_id") or learner.get("auth0_sub")
    if not learner_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Learner identity is missing")
    return str(learner_id)


def _service_unavailable(exc: Exception) -> HTTPException:
    logger.exception("Learning content generation failed")
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Learning content is temporarily unavailable. Please try again shortly.",
    )


@router.get("/concepts")
async def concepts(limit: int = Query(default=18, ge=1, le=50)):
    """List the highest-signal concepts extracted from completed source documents."""
    try:
        return await asyncio.to_thread(list_concepts, get_learning_graph(), limit)
    except Exception as exc:
        logger.exception("Could not load learning concepts")
        raise HTTPException(status_code=503, detail="The knowledge graph is unavailable") from exc


@router.get("/dashboard", response_model=LearningDashboard)
async def dashboard(learner: dict = Depends(get_learner)):
    """Return one cohesive home-screen view of course concepts and progress."""
    learner_id = _learner_id(learner)
    try:
        graph, mastery_rows = await asyncio.gather(
            asyncio.to_thread(list_concepts, get_learning_graph(), 50),
            asyncio.to_thread(list_mastery, learner_id),
        )
        return build_dashboard(graph, mastery_rows)
    except Exception as exc:
        logger.exception("Could not load learner dashboard")
        raise HTTPException(status_code=503, detail="Your learning dashboard is unavailable") from exc


@router.get("/mastery/{concept_id}", response_model=Mastery)
async def mastery(concept_id: str, learner: dict = Depends(get_learner)):
    learner_id = _learner_id(learner)
    row = await asyncio.to_thread(get_mastery, learner_id, concept_id)
    return mastery_from_row(concept_id, row)


@router.get("/lesson/{concept_id}", response_model=LessonResponse)
async def lesson(concept_id: str, learner: dict = Depends(get_learner)):
    _learner_id(learner)
    graph = get_learning_graph()
    concept = await asyncio.to_thread(get_concept, graph, concept_id)
    if not concept:
        raise HTTPException(status_code=404, detail="Concept was not found in completed course material")
    context, sources, source_hash = await asyncio.to_thread(get_source_context, graph, concept_id)
    if not context:
        raise HTTPException(status_code=409, detail="This concept does not have usable source material yet")

    cached_payload = await asyncio.to_thread(
        get_cached_learning_content, concept_id, "lesson", "", source_hash
    )
    cached = cached_payload is not None
    try:
        generated = (
            GeneratedLesson.model_validate(cached_payload)
            if cached_payload
            else await generate_lesson(concept.name, context)
        )
        if not cached:
            await asyncio.to_thread(
                cache_learning_content,
                concept_id,
                "lesson",
                "",
                source_hash,
                generated.model_dump(),
            )
    except Exception as exc:
        raise _service_unavailable(exc) from exc

    beats = [
        LessonBeat(key="core_idea", title="Core idea", content=generated.core_idea),
        LessonBeat(key="how_it_works", title="How it works", content=generated.how_it_works),
        LessonBeat(
            key="pulstar_application",
            title="PULSTAR application",
            content=generated.pulstar_application,
        ),
        LessonBeat(
            key="quick_check",
            title="Quick check",
            content="Check your understanding before moving to another concept.",
        ),
    ]
    return LessonResponse(
        concept=concept,
        beats=beats,
        quick_check=generated.quick_check,
        sources=sources,
        cached=cached,
    )


@router.post("/quiz/generate", response_model=QuizResponse)
async def quiz_generate(
    request: QuizGenerateRequest,
    learner: dict = Depends(get_learner),
):
    learner_id = _learner_id(learner)
    graph = get_learning_graph()
    concept = await asyncio.to_thread(get_concept, graph, request.concept_id)
    if not concept:
        raise HTTPException(status_code=404, detail="Concept was not found in completed course material")
    context, sources, source_hash = await asyncio.to_thread(
        get_source_context, graph, request.concept_id
    )
    if not context:
        raise HTTPException(status_code=409, detail="This concept does not have usable source material yet")

    mastery_row = await asyncio.to_thread(get_mastery, learner_id, request.concept_id)
    current_mastery = mastery_from_row(request.concept_id, mastery_row)
    cache_difficulty = f"{current_mastery.difficulty}:{request.question_count}"
    cached_payload = await asyncio.to_thread(
        get_cached_learning_content,
        request.concept_id,
        "quiz",
        cache_difficulty,
        source_hash,
    )
    cached = cached_payload is not None
    try:
        generated = (
            GeneratedQuiz.model_validate(cached_payload)
            if cached_payload
            else await generate_quiz(
                concept.name,
                current_mastery.difficulty,
                request.question_count,
                context,
            )
        )
        if not cached:
            await asyncio.to_thread(
                cache_learning_content,
                request.concept_id,
                "quiz",
                cache_difficulty,
                source_hash,
                generated.model_dump(),
            )
    except Exception as exc:
        raise _service_unavailable(exc) from exc

    quiz_id = str(uuid4())
    stored_questions = [question.model_dump() for question in generated.questions]
    await asyncio.to_thread(
        save_quiz_session,
        quiz_id,
        learner_id,
        request.concept_id,
        current_mastery.difficulty,
        stored_questions,
    )
    public_questions = [
        QuizQuestion(id=str(index), question=question.question, options=question.options)
        for index, question in enumerate(generated.questions)
    ]
    return QuizResponse(
        quiz_id=quiz_id,
        concept=concept,
        difficulty=current_mastery.difficulty,
        mastery=current_mastery,
        questions=public_questions,
        sources=sources,
        cached=cached,
    )


@router.post("/quiz/grade", response_model=QuizGradeResponse)
async def quiz_grade(
    request: QuizGradeRequest,
    learner: dict = Depends(get_learner),
):
    learner_id = _learner_id(learner)
    try:
        graded = await asyncio.to_thread(
            grade_quiz_session, request.quiz_id, learner_id, request.answers
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    updated_mastery = mastery_from_row(graded["concept_id"], graded["mastery"])
    return QuizGradeResponse(
        quiz_id=request.quiz_id,
        correct=graded["correct"],
        total=graded["total"],
        results=[GradedQuestion(**result) for result in graded["results"]],
        mastery=updated_mastery,
    )
