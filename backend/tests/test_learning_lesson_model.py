import unittest

from src.learning.models import GeneratedLesson

QUICK_CHECK = {
    "question": "Which option is correct?",
    "options": ["A", "B", "C", "D"],
    "answer_index": 0,
    "explanation": "The excerpt says A.",
}


class GeneratedLessonModelTests(unittest.TestCase):
    def test_reads_course_neutral_application_field(self):
        lesson = GeneratedLesson.model_validate(
            {
                "core_idea": "Core.",
                "how_it_works": "Steps.",
                "application": "Where it shows up.",
                "quick_check": QUICK_CHECK,
            }
        )

        self.assertEqual(lesson.application, "Where it shows up.")

    def test_reads_lessons_cached_under_the_legacy_field_name(self):
        cached_payload = {
            "core_idea": "Core.",
            "how_it_works": "Steps.",
            "pulstar_application": "Cached application text.",
            "quick_check": QUICK_CHECK,
        }

        lesson = GeneratedLesson.model_validate(cached_payload)

        self.assertEqual(lesson.application, "Cached application text.")
        # The cached row itself is left untouched.
        self.assertIn("pulstar_application", cached_payload)
        self.assertNotIn("pulstar_application", lesson.model_dump())

    def test_schema_offered_to_the_model_has_no_course_specific_field(self):
        properties = GeneratedLesson.model_json_schema()["properties"]

        self.assertIn("application", properties)
        self.assertNotIn("pulstar_application", properties)


if __name__ == "__main__":
    unittest.main()
