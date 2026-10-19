"""FastAPI router for CORA guided learning and adaptive assessment."""

import asyncio
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.auth import get_learner
from src.learning.generation import generate_lesson, generate_quiz
from src.model_tiers import cache_variant, learning_model_for
from src.learning.graph import (
    get_concept,
    get_concept_neighbourhood,
    get_concept_network,
    get_learning_graph,
    get_source_context,
    get_source_passages,
    get_suggested_concepts,
    get_course_stats,
    list_concepts,
)
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
    ConceptSources,
    ConceptNetwork,
    ConceptNeighbourhood,
    ConceptSuggestions,
    SourcePassage,
)
from src.learning.review_service import load_last_lesson, load_review_summary
from src.learning.review_store import list_touched_concepts
from src.learning.service import (
    attach_mastery,
    attach_neighbour_mastery,
    build_dashboard,
    build_suggestions,
    mastery_from_row,
)
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
        graph, course, mastery_rows, review, last_lesson = await asyncio.gather(
            asyncio.to_thread(list_concepts, get_learning_graph(), 50),
            asyncio.to_thread(get_course_stats, get_learning_graph()),
            asyncio.to_thread(list_mastery, learner_id),
            load_review_summary(learner_id, role=learner.get("role")),
            load_last_lesson(learner_id),
        )
        return build_dashboard(graph, mastery_rows, course).model_copy(
            update={"review": review, "last_lesson": last_lesson}
        )
    except Exception as exc:
        logger.exception("Could not load learner dashboard")
        raise HTTPException(status_code=503, detail="Your learning dashboard is unavailable") from exc


@router.get("/network", response_model=ConceptNetwork)
async def network(
    limit: int = Query(default=120, ge=20, le=250),
    learner: dict = Depends(get_learner),
):
    """Return a fast, bounded concept-only view of the course graph."""
    learner_id = _learner_id(learner)
    try:
        # Mastery rides along so the map can colour by learning state in one
        # request. A guest saves nothing, so this comes back empty for them and
        # every node reads "not started" -- which is true.
        graph, mastery_rows = await asyncio.gather(
            asyncio.to_thread(get_concept_network, get_learning_graph(), limit),
            asyncio.to_thread(list_mastery, learner_id),
        )
        return attach_mastery(ConceptNetwork(**graph), mastery_rows)
    except Exception as exc:
        logger.exception("Could not load learning concept network")
        raise HTTPException(status_code=503, detail="The course map is unavailable") from exc


# `:path` lets the id itself contain "/" -- 30 concept ids do, such as "Cr2/Cr1" --
# which a plain {concept_id} would 404 before this handler ever ran.
@router.get("/concepts/{concept_id:path}/neighbourhood", response_model=ConceptNeighbourhood)
async def concept_neighbourhood(
    concept_id: str,
    limit: int = Query(default=8, ge=1, le=20),
    learner: dict = Depends(get_learner),
):
    """Return one concept's linked concepts, with the learner's mastery on each.

    Unlike /network, this reaches every neighbour of the concept, not only the
    ones inside the top-ranked slice the course map draws.
    """
    learner_id = _learner_id(learner)
    try:
        graph = get_learning_graph()
        concept, neighbourhood, mastery_rows = await asyncio.gather(
            asyncio.to_thread(get_concept, graph, concept_id),
            asyncio.to_thread(get_concept_neighbourhood, graph, concept_id, limit),
            asyncio.to_thread(list_mastery, learner_id),
        )
    except Exception as exc:
        logger.exception("Could not load concept neighbourhood")
        raise HTTPException(status_code=503, detail="Linked concepts are unavailable") from exc

    # Raised outside the try on purpose: `except Exception` would turn it into a 503.
    if concept is None:
        raise HTTPException(status_code=404, detail="Concept was not found in completed course material")
    return attach_neighbour_mastery(
        ConceptNeighbourhood(concept=concept, **neighbourhood), mastery_rows
    )


@router.get("/suggestions", response_model=ConceptSuggestions)
async def suggestions(
    limit: int = Query(default=3, ge=1, le=10),
    learner: dict = Depends(get_learner),
):
    """Suggest concepts linked to what the learner has worked on, but not worked on yet.

    "Worked on" is the same test the review queue uses -- a quiz, a lesson
    position or a graded card -- so reading a lesson is enough to be suggested
    from. Keying this off quiz mastery alone left Home's "Suggested next" empty
    for every learner who had only read.
    """
    learner_id = _learner_id(learner)
    try:
        # One after the other on purpose: the graph query needs the started ids.
        started_ids = await asyncio.to_thread(list_touched_concepts, learner_id)
        if not started_ids:
            # Nothing started means nothing to link from; Home shows its own
            # empty state, so skip the graph entirely.
            return ConceptSuggestions()
        items = await asyncio.to_thread(
            get_suggested_concepts, get_learning_graph(), started_ids, limit
        )
    except Exception as exc:
        logger.exception("Could not load suggested concepts")
        raise HTTPException(status_code=503, detail="Suggestions are unavailable") from exc
    return build_suggestions(items)


@router.get("/mastery/{concept_id}", response_model=Mastery)
async def mastery(concept_id: str, learner: dict = Depends(get_learner)):
    learner_id = _learner_id(learner)
    row = await asyncio.to_thread(get_mastery, learner_id, concept_id)
    return mastery_from_row(concept_id, row)


@router.get("/sources/{concept_id}", response_model=ConceptSources)
async def sources(concept_id: str, learner: dict = Depends(get_learner)):
    """Expose the exact course passages used to ground a concept."""
    _learner_id(learner)
    graph = get_learning_graph()
    concept = await asyncio.to_thread(get_concept, graph, concept_id)
    if not concept:
        raise HTTPException(status_code=404, detail="Concept was not found in completed course material")
    rows = await asyncio.to_thread(get_source_passages, graph, concept_id)
    return ConceptSources(
        concept=concept,
        passages=[
            SourcePassage(id=f"{concept_id}:{index}", **row)
            for index, row in enumerate(rows)
        ],
    )


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

    # Guests' free-model lessons live in their own cache slot (see model_tiers).
    role = learner.get("role")
    variant = cache_variant(role, "")
    cached_payload = await asyncio.to_thread(
        get_cached_learning_content, concept_id, "lesson", variant, source_hash
    )
    cached = cached_payload is not None
    try:
        generated = (
            GeneratedLesson.model_validate(cached_payload)
            if cached_payload
            else await generate_lesson(concept.name, context, model=learning_model_for(role))
        )
        if not cached:
            await asyncio.to_thread(
                cache_learning_content,
                concept_id,
                "lesson",
                variant,
                source_hash,
                generated.model_dump(),
            )
    except Exception as exc:
        raise _service_unavailable(exc) from exc

    beats = [
        LessonBeat(key="core_idea", title="Core idea", content=generated.core_idea),
        LessonBeat(key="how_it_works", title="How it works", content=generated.how_it_works),
        LessonBeat(
            key="application",
            title="In the material",
            content=generated.application,
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
    role = learner.get("role")
    cache_difficulty = cache_variant(role, f"{current_mastery.difficulty}:{request.question_count}")
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
                model=learning_model_for(role),
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
