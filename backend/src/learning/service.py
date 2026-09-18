"""Application-level learning logic that is independent of FastAPI."""

from src.learning.models import (
    Concept,
    ConceptProgress,
    DashboardRecommendation,
    LearningDashboard,
    Mastery,
)


def difficulty_for(attempts: int, correct: int) -> str:
    """Choose the next difficulty from transparent per-concept mastery."""
    if attempts <= 0:
        return "easy"
    score = correct / attempts
    if score < 0.40:
        return "easy"
    if score < 0.75:
        return "medium"
    return "hard"


def mastery_from_row(concept_id: str, row: dict | None) -> Mastery:
    attempts = int(row["attempts"]) if row else 0
    correct = int(row["correct"]) if row else 0
    score = round((correct / attempts) * 100, 1) if attempts else 0
    return Mastery(
        concept_id=concept_id,
        attempts=attempts,
        correct=correct,
        score=score,
        difficulty=difficulty_for(attempts, correct),
    )


def build_dashboard(
    concepts: list[Concept], mastery_rows: dict[str, dict]
) -> LearningDashboard:
    """Combine graph concepts with learner progress into the student home model."""
    progress = [
        ConceptProgress(
            concept=concept,
            mastery=mastery_from_row(concept.id, mastery_rows.get(concept.id)),
        )
        for concept in concepts
    ]
    started = [item for item in progress if item.mastery.attempts > 0]
    mastered = [item for item in started if item.mastery.score >= 80]
    average = round(sum(item.mastery.score for item in progress) / len(progress), 1) if progress else 0

    # Resume unfinished work before introducing another concept. For a new
    # learner, Neo4j's connectivity ranking supplies the strongest starting point.
    unfinished = [item for item in started if item.mastery.score < 80]
    if unfinished:
        choice = max(
            unfinished,
            key=lambda item: (item.mastery.attempts, item.concept.connectivity),
        )
        recommended = DashboardRecommendation(
            concept=choice.concept,
            mastery=choice.mastery,
            reason="Continue learning",
        )
    else:
        new_items = [item for item in progress if item.mastery.attempts == 0]
        choice = new_items[0] if new_items else (progress[0] if progress else None)
        recommended = (
            DashboardRecommendation(
                concept=choice.concept,
                mastery=choice.mastery,
                reason="Recommended starting point" if new_items else "Review a mastered concept",
            )
            if choice
            else None
        )

    return LearningDashboard(
        total_concepts=len(progress),
        started_concepts=len(started),
        mastered_concepts=len(mastered),
        average_mastery=average,
        recommended=recommended,
        concepts=progress,
    )
