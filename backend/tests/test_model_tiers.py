"""The server, not the browser, decides which LLM a request may use.

Before this, /chat_bot took a `model` form field from the browser and used it
as-is, so a guest (no login) could ask for a paid OpenAI model. Lessons,
quizzes and flashcards always used the paid LEARNING_MODEL, even for guests.

Now:
- Guests always get the free model named in GUEST_LLM_MODEL. If it is not set,
  guest AI features are refused instead of quietly falling back to a paid model.
- Signed-in students and TAs get the course models (LEARNER_CHAT_MODEL for
  chat, LEARNING_MODEL for lessons, quizzes and cards). Their `model` field is ignored.
- Only staff (admin, test_full) may pick a model by name, for testing.
- Content a guest's free model generates is cached separately, so signed-in
  learners never get it.

No Neo4j, Postgres or LLM is used: everything that would touch them is patched.
"""

import importlib
import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

import score
from src import model_tiers
from src.auth import get_chat_learner, get_learner
from src.entities.user_credential import get_server_neo4j_credentials
from src.learning import review_service
from src.learning.models import Concept

# `from src.learning import router` returns the APIRouter, not the module.
router_module = importlib.import_module("src.learning.router")

GUEST = {"learner_id": "guest:11111111-1111-4111-8111-111111111111", "role": "guest"}
STUDENT = {"learner_id": "auth0|student-1", "auth0_sub": "auth0|student-1", "role": "student"}
ADMIN = {"learner_id": "auth0|admin-1", "auth0_sub": "auth0|admin-1", "role": "admin"}

PAID_MODEL = "openai_gpt_5.2"
FREE_MODEL = "guest_free"
TIER_ENV = {
    "GUEST_LLM_MODEL": FREE_MODEL,
    "LEARNER_CHAT_MODEL": "openai_gpt_4o_mini",
    "LEARNING_MODEL": "openai_gpt_4o",
    # The free model's provider line (placeholder values; nothing is called).
    "LLM_MODEL_CONFIG_GUEST_FREE": "llama-3.1-8b-instant,https://example.invalid/v1,test-key",
}
# The same settings, but with no guest model configured.
NO_GUEST_ENV = {key: value for key, value in TIER_ENV.items() if key != "GUEST_LLM_MODEL"}


def env(values):
    """Replace the tier settings for one test, leaving the rest of the env alone."""
    cleared = {key: "" for key in TIER_ENV}
    patcher = patch.dict(os.environ, {**cleared, **values})
    return patcher


class ChatModelChoiceTests(unittest.TestCase):
    def test_guest_gets_the_free_model_even_when_asking_for_a_paid_one(self):
        with env(TIER_ENV):
            self.assertEqual(model_tiers.chat_model_for("guest", PAID_MODEL), FREE_MODEL)

    def test_guest_is_refused_when_no_free_model_is_configured(self):
        with env(NO_GUEST_ENV):
            with self.assertRaises(model_tiers.GuestModelNotConfigured):
                model_tiers.chat_model_for("guest", PAID_MODEL)

    def test_guest_is_refused_when_the_free_models_config_line_is_blank(self):
        # example.env ships LLM_MODEL_CONFIG_guest_free="" -- that must mean "off".
        with env(TIER_ENV), patch.dict(os.environ, {"LLM_MODEL_CONFIG_GUEST_FREE": ""}):
            with self.assertRaises(model_tiers.GuestModelNotConfigured):
                model_tiers.chat_model_for("guest", None)

    def test_student_gets_the_course_chat_model_whatever_they_ask_for(self):
        with env(TIER_ENV):
            self.assertEqual(model_tiers.chat_model_for("student", PAID_MODEL), "openai_gpt_4o_mini")

    def test_ta_cannot_pick_a_model_either(self):
        with env(TIER_ENV):
            self.assertEqual(model_tiers.chat_model_for("ta", PAID_MODEL), "openai_gpt_4o_mini")

    def test_admin_may_pick_a_model_for_testing(self):
        with env(TIER_ENV):
            self.assertEqual(model_tiers.chat_model_for("admin", PAID_MODEL), PAID_MODEL)

    def test_admin_without_a_choice_gets_the_course_chat_model(self):
        with env(TIER_ENV):
            self.assertEqual(model_tiers.chat_model_for("admin", None), "openai_gpt_4o_mini")

    def test_learner_chat_model_has_a_safe_default(self):
        with env({}):
            self.assertEqual(
                model_tiers.chat_model_for("student", None), model_tiers.DEFAULT_LEARNER_CHAT_MODEL
            )


class LearningModelChoiceTests(unittest.TestCase):
    def test_guest_lessons_use_the_free_model(self):
        with env(TIER_ENV):
            self.assertEqual(model_tiers.learning_model_for("guest"), FREE_MODEL)

    def test_guest_lessons_are_refused_without_a_free_model(self):
        with env(NO_GUEST_ENV):
            with self.assertRaises(model_tiers.GuestModelNotConfigured):
                model_tiers.learning_model_for("guest")

    def test_student_lessons_use_the_learning_model(self):
        with env(TIER_ENV):
            self.assertEqual(model_tiers.learning_model_for("student"), "openai_gpt_4o")


class CacheVariantTests(unittest.TestCase):
    def test_signed_in_learners_share_the_normal_cache(self):
        self.assertEqual(model_tiers.cache_variant("student", ""), "")
        self.assertEqual(model_tiers.cache_variant("admin", "easy:5"), "easy:5")

    def test_guest_content_is_cached_apart(self):
        self.assertEqual(model_tiers.cache_variant("guest", ""), "guest")
        self.assertEqual(model_tiers.cache_variant("guest", "easy:5"), "guest:easy:5")


class ChatRouteTierTests(unittest.TestCase):
    def setUp(self):
        self.app = score.app
        self.addCleanup(self.app.dependency_overrides.clear)
        self.app.dependency_overrides[get_server_neo4j_credentials] = lambda: MagicMock()
        self.client = TestClient(self.app)

        self.qa_rag = MagicMock(side_effect=lambda **kwargs: {
            "session_id": kwargs["session_id"], "message": "ok", "info": {},
        })
        access = MagicMock()
        access.return_value.check_account_access.return_value = False
        patches = [
            patch.object(score, "QA_RAG", self.qa_rag),
            patch.object(score, "create_graph_database_connection", return_value=MagicMock()),
            patch.object(score, "graphDBdataAccess", access),
            patch.object(score, "publication_fingerprint", return_value="rev1"),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def ask_as(self, learner, model=PAID_MODEL):
        self.app.dependency_overrides[get_chat_learner] = lambda: learner
        return self.client.post(
            "/chat_bot",
            data={"question": "What is decay heat?", "session_id": "s1", "mode": "vector", "model": model},
        )

    def test_guest_asking_for_a_paid_model_gets_the_free_one(self):
        with env(TIER_ENV):
            self.ask_as(GUEST)

        self.assertEqual(self.qa_rag.call_args.kwargs["model"], FREE_MODEL)

    def test_guest_chat_is_refused_without_calling_any_model_when_unconfigured(self):
        with env(NO_GUEST_ENV):
            response = self.ask_as(GUEST)

        self.qa_rag.assert_not_called()
        self.assertEqual(response.status_code, 503)
        # A plain message, without leaking setting names to the public.
        self.assertNotIn("GUEST_LLM_MODEL", response.text)

    def test_chat_errors_hide_internal_details_from_learners(self):
        self.qa_rag.side_effect = RuntimeError("Environment variable 'LLM_MODEL_CONFIG_SECRET' is missing")
        with env(TIER_ENV):
            response = self.ask_as(STUDENT)

        self.assertEqual(response.json()["status"], "Failed")
        self.assertNotIn("LLM_MODEL_CONFIG", response.text)

    def test_chat_errors_keep_details_for_staff(self):
        self.qa_rag.side_effect = RuntimeError("Environment variable 'LLM_MODEL_CONFIG_SECRET' is missing")
        with env(TIER_ENV):
            response = self.ask_as(ADMIN)

        self.assertIn("LLM_MODEL_CONFIG_SECRET", response.text)

    def test_student_model_field_is_ignored(self):
        with env(TIER_ENV):
            self.ask_as(STUDENT)

        self.assertEqual(self.qa_rag.call_args.kwargs["model"], "openai_gpt_4o_mini")

    def test_admin_model_field_is_honoured(self):
        with env(TIER_ENV):
            self.ask_as(ADMIN)

        self.assertEqual(self.qa_rag.call_args.kwargs["model"], PAID_MODEL)


class LearningRouteTierTests(unittest.TestCase):
    """Lessons and quizzes pick their model and cache slot from the learner's role."""

    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(router_module.router)
        self.client = TestClient(self.app)

        concept = Concept(id="decay-heat", name="Decay heat", chunk_count=3, document_count=1, connectivity=2)
        # The generator fails on purpose: we only care which model it was handed.
        self.generate_lesson = AsyncMock(side_effect=RuntimeError("no LLM in tests"))
        self.generate_quiz = AsyncMock(side_effect=RuntimeError("no LLM in tests"))
        self.read_cache = MagicMock(return_value=None)
        patches = [
            patch.object(router_module, "get_learning_graph", return_value=MagicMock()),
            patch.object(router_module, "get_concept", return_value=concept),
            patch.object(router_module, "get_source_context", return_value=("excerpt", ["a.pdf"], "hash1")),
            patch.object(router_module, "get_cached_learning_content", self.read_cache),
            patch.object(router_module, "cache_learning_content"),
            patch.object(router_module, "get_mastery", return_value=None),
            patch.object(router_module, "generate_lesson", self.generate_lesson),
            patch.object(router_module, "generate_quiz", self.generate_quiz),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def act_as(self, learner):
        self.app.dependency_overrides[get_learner] = lambda: learner

    def test_guest_lesson_uses_the_free_model_and_the_guest_cache(self):
        self.act_as(GUEST)
        with env(TIER_ENV):
            self.client.get("/learning/lesson/decay-heat")

        self.assertEqual(self.generate_lesson.call_args.kwargs["model"], FREE_MODEL)
        self.assertEqual(self.read_cache.call_args.args[2], "guest")

    def test_student_lesson_uses_the_learning_model_and_the_shared_cache(self):
        self.act_as(STUDENT)
        with env(TIER_ENV):
            self.client.get("/learning/lesson/decay-heat")

        self.assertEqual(self.generate_lesson.call_args.kwargs["model"], "openai_gpt_4o")
        self.assertEqual(self.read_cache.call_args.args[2], "")

    def test_guest_lesson_is_refused_without_a_free_model(self):
        self.act_as(GUEST)
        with env(NO_GUEST_ENV):
            response = self.client.get("/learning/lesson/decay-heat")

        self.assertEqual(response.status_code, 503)
        self.generate_lesson.assert_not_called()

    def test_guest_quiz_uses_the_free_model_and_the_guest_cache(self):
        self.act_as(GUEST)
        with env(TIER_ENV):
            self.client.post("/learning/quiz/generate", json={"concept_id": "decay-heat"})

        self.assertEqual(self.generate_quiz.call_args.kwargs["model"], FREE_MODEL)
        self.assertTrue(self.read_cache.call_args.args[2].startswith("guest:"))


class FlashcardTierTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        concept = Concept(id="decay-heat", name="Decay heat", chunk_count=3, document_count=1, connectivity=2)
        self.generate_flashcards = AsyncMock(side_effect=RuntimeError("no LLM in tests"))
        self.read_cache = MagicMock(return_value=None)
        patches = [
            patch.object(review_service, "get_concept", return_value=concept),
            patch.object(review_service, "get_source_context", return_value=("excerpt", ["a.pdf"], "hash1")),
            patch.object(review_service, "get_cached_learning_content", self.read_cache),
            patch.object(review_service, "cache_learning_content"),
            patch.object(review_service, "generate_flashcards", self.generate_flashcards),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    async def test_guest_deck_uses_the_free_model_and_the_guest_cache(self):
        with env(TIER_ENV), self.assertRaises(RuntimeError):
            await review_service._load_concept_cards(MagicMock(), "decay-heat", True, role="guest")

        self.assertEqual(self.generate_flashcards.call_args.kwargs["model"], FREE_MODEL)
        self.assertEqual(self.read_cache.call_args.args[2], "guest")

    async def test_guest_without_a_free_model_gets_no_new_deck_instead_of_an_error(self):
        with env(NO_GUEST_ENV):
            deck = await review_service._load_concept_cards(MagicMock(), "decay-heat", True, role="guest")

        self.assertIsNone(deck)
        self.generate_flashcards.assert_not_called()

    async def test_student_deck_uses_the_learning_model_and_the_shared_cache(self):
        with env(TIER_ENV), self.assertRaises(RuntimeError):
            await review_service._load_concept_cards(MagicMock(), "decay-heat", True, role="student")

        self.assertEqual(self.generate_flashcards.call_args.kwargs["model"], "openai_gpt_4o")
        self.assertEqual(self.read_cache.call_args.args[2], "")


if __name__ == "__main__":
    unittest.main()
