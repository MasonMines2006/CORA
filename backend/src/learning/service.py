"""Application-level learning logic that is independent of FastAPI."""

from src.learning.models import (
    Concept,
    ConceptNeighbourhood,
    ConceptNetwork,
    ConceptProgress,
    ConceptRef,
    ConceptSuggestion,
    ConceptSuggestions,
    CourseStats,
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


def attach_mastery(network: ConceptNetwork, mastery_rows: dict[str, dict]) -> ConceptNetwork:
    """Colour the course map by learning state rather than by extracted type.

    Every node gets a Mastery, including concepts the learner has never opened --
    "not started" is a state the map draws, so returning None there would make the
    frontend guess. Guests save nothing, so an empty `mastery_rows` is normal.
    """
    return network.model_copy(
        update={
            "nodes": [
                node.model_copy(
                    update={"mastery": mastery_from_row(node.id, mastery_rows.get(node.id))}
                )
                for node in network.nodes
            ]
        }
    )


def _was_attempted(row: dict | None) -> bool:
    return bool(row) and int(row.get("attempts") or 0) > 0


def attach_neighbour_mastery(
    neighbourhood: ConceptNeighbourhood, mastery_rows: dict[str, dict]
) -> ConceptNeighbourhood:
    """Put the learner's mastery on each linked concept.

    Unlike the course map, a neighbour the learner never attempted gets None:
    the concept hub's "Linked concepts" rail draws an em-dash for it.
    """
    neighbours = []
    for neighbour in neighbourhood.neighbours:
        row = mastery_rows.get(neighbour.id)
        mastery = mastery_from_row(neighbour.id, row) if _was_attempted(row) else None
        neighbours.append(neighbour.model_copy(update={"mastery": mastery}))
    return neighbourhood.model_copy(update={"neighbours": neighbours})


def suggestion_reason(because_of_name: str, relationship: str, shared_passages: int) -> str:
    """One short line under a suggestion on Home, saying why it is there."""
    if shared_passages > 0:
        noun = "passage" if shared_passages == 1 else "passages"
        return f"Appears with {because_of_name} in {shared_passages} {noun}"
    return f"Linked to {because_of_name} ({relationship})"


def build_suggestions(items: list[dict]) -> ConceptSuggestions:
    """Turn get_suggested_concepts() output into the response, with reasons."""
    return ConceptSuggestions(
        suggestions=[
            ConceptSuggestion(
                concept=item["concept"],
                because_of=ConceptRef(**item["because_of"]),
                relationship=item["relationship"],
                shared_passages=item["shared_passages"],
                reason=suggestion_reason(
                    item["because_of"]["name"], item["relationship"], item["shared_passages"]
                ),
            )
            for item in items
        ]
    )


def build_dashboard(
    concepts: list[Concept],
    mastery_rows: dict[str, dict],
    course: CourseStats | None = None,
) -> LearningDashboard:
    """Combine graph concepts with learner progress into the student home model.

    `concepts` is a ranked sample (Home shows the top few). `course` carries the
    real whole-course counts; without it, the sample is all we know.
    """
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

    course = course or CourseStats(concepts=len(progress))
    return LearningDashboard(
        total_concepts=course.concepts,
        course=course,
        started_concepts=len(started),
        mastered_concepts=len(mastered),
        average_mastery=average,
        recommended=recommended,
        concepts=progress,
    )
