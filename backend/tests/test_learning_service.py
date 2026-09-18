import unittest

from src.learning.service import difficulty_for, mastery_from_row


class LearningMasteryTests(unittest.TestCase):
    def test_new_learner_starts_at_easy(self):
        self.assertEqual(difficulty_for(0, 0), "easy")

    def test_difficulty_thresholds_are_transparent(self):
        self.assertEqual(difficulty_for(10, 3), "easy")
        self.assertEqual(difficulty_for(10, 4), "medium")
        self.assertEqual(difficulty_for(4, 3), "hard")

    def test_mastery_exposes_percentage_and_next_difficulty(self):
        mastery = mastery_from_row("criticality", {"attempts": 4, "correct": 3})

        self.assertEqual(mastery.score, 75.0)
        self.assertEqual(mastery.difficulty, "hard")


if __name__ == "__main__":
    unittest.main()
