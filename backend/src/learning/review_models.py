"""Request and response models for spaced review and lesson position."""

from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from src.learning.review import CardStatus, Grade

# The lesson endpoint returns four beats; this leaves room to grow without
# letting a client store an absurd position.
MAX_LESSON_BEATS = 10


class ReviewIntervals(BaseModel):
    """Seconds until the card returns, for each grade button."""

    again: int
    hard: int
    good: int
    easy: int


class ReviewCard(BaseModel):
    card_id: str
    concept_id: str
    concept_name: str
    prompt: str
    answer: str
    source: str
    state: CardStatus
    last_reviewed_at: datetime | None = None
    due_at: datetime | None = None
    intervals: ReviewIntervals


class ReviewQueue(BaseModel):
    # Totals, independent of how many cards this response carries.
    due_count: int = 0
    new_count: int = 0
    cards: list[ReviewCard] = Field(default_factory=list)


class ReviewSummary(BaseModel):
    due_count: int = 0
    new_count: int = 0


class ReviewGradeRequest(BaseModel):
    card_id: str = Field(min_length=1, max_length=512)
    grade: Grade


class ReviewGradeResponse(BaseModel):
    card_id: str
    due_at: datetime
    interval_seconds: int
    state: CardStatus


class LessonProgressRequest(BaseModel):
    beat_index: int = Field(ge=0)
    beat_count: int = Field(ge=1, le=MAX_LESSON_BEATS)

    @model_validator(mode="after")
    def _index_within_lesson(self) -> "LessonProgressRequest":
        if self.beat_index >= self.beat_count:
            raise ValueError("beat_index must be less than beat_count")
        return self


class LastLesson(BaseModel):
    concept_id: str
    concept_name: str
    beat_index: int
    beat_count: int
    updated_at: datetime
