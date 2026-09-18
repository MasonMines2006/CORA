import unittest

from src.learning.models import Concept
from src.learning.service import build_dashboard


def concept(name: str, connectivity: int) -> Concept:
    return Concept(
        id=name.lower().replace(" ", "-"),
        name=name,
        chunk_count=8,
        document_count=2,
        connectivity=connectivity,
        sources=["NE235.pdf"],
    )


class LearningDashboardTests(unittest.TestCase):
    def test_dashboard_summarizes_progress_and_recommends_in_progress_work(self):
        concepts = [
            concept("Reactivity", 50),
            concept("Criticality", 40),
            concept("Xenon", 30),
        ]
        mastery_rows = {
            "reactivity": {"attempts": 5, "correct": 4},
            "criticality": {"attempts": 4, "correct": 2},
        }

        dashboard = build_dashboard(concepts, mastery_rows)

        self.assertEqual(dashboard.total_concepts, 3)
        self.assertEqual(dashboard.started_concepts, 2)
        self.assertEqual(dashboard.mastered_concepts, 1)
        self.assertEqual(dashboard.average_mastery, 43.3)
        self.assertEqual(dashboard.recommended.concept.id, "criticality")
        self.assertEqual(dashboard.recommended.reason, "Continue learning")

    def test_dashboard_recommends_highest_signal_new_concept_for_new_learner(self):
        concepts = [concept("Reactivity", 50), concept("Criticality", 40)]

        dashboard = build_dashboard(concepts, {})

        self.assertEqual(dashboard.started_concepts, 0)
        self.assertEqual(dashboard.average_mastery, 0)
        self.assertEqual(dashboard.recommended.concept.id, "reactivity")
        self.assertEqual(dashboard.recommended.reason, "Recommended starting point")

    def test_empty_course_has_no_recommendation(self):
        dashboard = build_dashboard([], {})

        self.assertEqual(dashboard.total_concepts, 0)
        self.assertIsNone(dashboard.recommended)
        self.assertEqual(dashboard.concepts, [])


if __name__ == "__main__":
    unittest.main()
