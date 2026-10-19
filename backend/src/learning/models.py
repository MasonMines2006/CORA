"""Request and response models for CORA learning modes."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from src.learning.review_models import LastLesson, ReviewSummary


Difficulty = Literal["easy", "medium", "hard"]


class Concept(BaseModel):
    id: str
    name: str
    chunk_count: int
    document_count: int
    connectivity: int
    sources: list[str] = Field(default_factory=list)


class Mastery(BaseModel):
    concept_id: str
    attempts: int = 0
    correct: int = 0
    score: float = 0
    difficulty: Difficulty = "easy"


class ConceptProgress(BaseModel):
    concept: Concept
    mastery: Mastery


class DashboardRecommendation(ConceptProgress):
    reason: str


class CourseStats(BaseModel):
    """Whole-course counts for Home, over published material only.

    Counted directly in Neo4j rather than derived from the dashboard's concept
    sample, which is truncated and would undercount documents and double-count
    passages shared by several concepts.
    """

    documents: int = 0
    passages: int = 0
    concepts: int = 0


class LearningDashboard(BaseModel):
    # Every concept in the published course, not just the ones in `concepts`.
    total_concepts: int
    started_concepts: int
    mastered_concepts: int
    average_mastery: float
    recommended: DashboardRecommendation | None = None
    concepts: list[ConceptProgress] = Field(default_factory=list)
    # Home's "cards due" card and "pick up where you left off" card.
    review: ReviewSummary = Field(default_factory=ReviewSummary)
    last_lesson: LastLesson | None = None
    course: CourseStats = Field(default_factory=CourseStats)


class SourcePassage(BaseModel):
    id: str
    source: str
    text: str


class ConceptSources(BaseModel):
    concept: Concept
    passages: list[SourcePassage] = Field(default_factory=list)


class NetworkNode(BaseModel):
    id: str
    name: str
    labels: list[str] = Field(default_factory=list)
    # The Explore artboard sizes each node by passage count, filters by source
    # document, and colours by learning state, so all three travel with the node.
    chunk_count: int = 0
    document_count: int = 0
    sources: list[str] = Field(default_factory=list)
    mastery: "Mastery | None" = None


class NetworkRelationship(BaseModel):
    id: str
    from_id: str
    to_id: str
    type: str


class ConceptNetwork(BaseModel):
    nodes: list[NetworkNode] = Field(default_factory=list)
    relationships: list[NetworkRelationship] = Field(default_factory=list)


class ConceptNeighbour(BaseModel):
    """A concept linked to the concept hub's centre, for Graph mode and the
    "Linked concepts" rail."""

    id: str
    name: str
    labels: list[str] = Field(default_factory=list)
    chunk_count: int = 0
    # The relationship type between the two, and which way it points relative to
    # the centre: "out" reads "centre CALCULATED_FROM neighbour".
    relationship: str
    direction: Literal["out", "in"]
    # Passages that mention both concepts -- the strength of the link.
    shared_passages: int = 0
    # None when the learner never attempted it: the rail draws an em-dash there,
    # and a 0% Mastery would read as "attempted and got nothing right".
    mastery: Mastery | None = None


class ConceptNeighbourhood(BaseModel):
    concept: Concept
    # Every eligible neighbour, not just the ones in `neighbours`.
    linked_count: int = 0
    neighbours: list[ConceptNeighbour] = Field(default_factory=list)


class ConceptRef(BaseModel):
    id: str
    name: str


class ConceptSuggestion(BaseModel):
    concept: Concept
    # The started concept this suggestion is linked to.
    because_of: ConceptRef
    relationship: str
    shared_passages: int = 0
    reason: str


class ConceptSuggestions(BaseModel):
    suggestions: list[ConceptSuggestion] = Field(default_factory=list)


class LessonBeat(BaseModel):
    key: Literal["core_idea", "how_it_works", "application", "quick_check"]
    title: str
    content: str


class QuickCheck(BaseModel):
    question: str
    options: list[str]
    answer_index: int
    explanation: str


class GeneratedLesson(BaseModel):
    core_idea: str
    how_it_works: str
    application: str
    quick_check: QuickCheck

    @model_validator(mode="before")
    @classmethod
    def _accept_legacy_application_key(cls, data):
        """Read lessons cached before the course-neutral rename.

        Lessons generated earlier were stored in `learning_content_cache` with a
        `pulstar_application` field. Mapping it here keeps those cached rows valid
        instead of failing validation (which would surface as a 503) or forcing a
        paid regeneration of every lesson.
        """
        if isinstance(data, dict) and "application" not in data and "pulstar_application" in data:
            # Build a new dict rather than mutating the cached payload in place.
            renamed = {key: value for key, value in data.items() if key != "pulstar_application"}
            return {**renamed, "application": data["pulstar_application"]}
        return data


class LessonResponse(BaseModel):
    concept: Concept
    beats: list[LessonBeat]
    quick_check: QuickCheck
    sources: list[str]
    cached: bool = False


class QuizGenerateRequest(BaseModel):
    concept_id: str = Field(min_length=1)
    question_count: int = Field(default=3, ge=1, le=5)


class GeneratedQuestion(BaseModel):
    question: str
    options: list[str]
    answer_index: int
    explanation: str


class GeneratedQuiz(BaseModel):
    questions: list[GeneratedQuestion]


class GeneratedFlashcard(BaseModel):
    question: str
    answer: str
    source: str


class GeneratedFlashcards(BaseModel):
    cards: list[GeneratedFlashcard] = Field(min_length=1, max_length=7)


class QuizQuestion(BaseModel):
    id: str
    question: str
    options: list[str]


class QuizResponse(BaseModel):
    quiz_id: str
    concept: Concept
    difficulty: Difficulty
    mastery: Mastery
    questions: list[QuizQuestion]
    sources: list[str]
    cached: bool = False


class QuizGradeRequest(BaseModel):
    quiz_id: str = Field(min_length=1)
    answers: list[int]


class GradedQuestion(BaseModel):
    id: str
    selected_index: int
    correct_index: int
    is_correct: bool
    explanation: str


class QuizGradeResponse(BaseModel):
    quiz_id: str
    correct: int
    total: int
    results: list[GradedQuestion]
    mastery: Mastery
