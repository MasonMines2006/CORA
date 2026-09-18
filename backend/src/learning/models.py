"""Request and response models for CORA learning modes."""

from typing import Literal

from pydantic import BaseModel, Field


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


class LearningDashboard(BaseModel):
    total_concepts: int
    started_concepts: int
    mastered_concepts: int
    average_mastery: float
    recommended: DashboardRecommendation | None = None
    concepts: list[ConceptProgress] = Field(default_factory=list)


class SourcePassage(BaseModel):
    id: str
    source: str
    text: str


class ConceptSources(BaseModel):
    concept: Concept
    passages: list[SourcePassage] = Field(default_factory=list)


class LessonBeat(BaseModel):
    key: Literal["core_idea", "how_it_works", "pulstar_application", "quick_check"]
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
    pulstar_application: str
    quick_check: QuickCheck


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
