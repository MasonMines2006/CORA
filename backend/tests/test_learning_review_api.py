"""The review and lesson-progress endpoints, end to end except for Neo4j.

The routers, validation, guest identity and Postgres store are all real. Only
the graph and content generation are replaced, so the tests control source
revisions and generated decks without making paid LLM calls.
Rows are written under a fresh guest id and deleted afterwards. Skips cleanly
when no Postgres is configured.
"""

import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.auth import get_auth_settings
from src.learning import review_router as review_router_module
from src.learning import review_service
from src.learning.models import Concept, GeneratedFlashcard, GeneratedFlashcards
from src.learning.flashcards import make_card_id
from src.learning.review import DAY
from src.learning.review_router import router as review_router
from src.learning.review_store import ensure_review_tables, record_grade
from src.learning.router import router as learning_router
from src.user_store import ensure_learning_tables, get_pool

SOURCES = ["Published Source.pdf"]
VERSION = "abcdef0123456789" * 4

# Concepts the fake graph knows. Some have no cached deck yet; review generates it.
CACHED = ("Reactivity", "Reactor", "Reactor Period")
UNCACHED = "Xenon"
STALE = "Keff"
KNOWN = (*CACHED, UNCACHED, STALE)


def deck(name: str) -> GeneratedFlashcards:
    return GeneratedFlashcards(cards=[
        GeneratedFlashcard(question=f"Question {index} on {name}?", answer=f"Answer {index}.", source=SOURCES[0])
        for index in range(4)
    ])


def card_id(name: str, index: int) -> str:
    return make_card_id(name, VERSION, index)


def fake_source_context(graph, concept_id):
    if concept_id not in KNOWN:
        return "", [], "no-context"
    return f"SOURCE: {SOURCES[0]}\ntext", SOURCES, VERSION


def fake_cached_content(concept_id, content_type, difficulty, source_hash):
    if content_type != "cards" or difficulty != "":
        return None
    if concept_id in CACHED and source_hash == VERSION:
        return deck(concept_id).model_dump()
    return None


async def fake_generate_cards(name, context, sources):
    return deck(name)


def fake_get_concept(graph, concept_id):
    if concept_id not in KNOWN:
        return None
    return Concept(id=concept_id, name=concept_id, chunk_count=4, document_count=1, connectivity=9)


def _postgres_available() -> bool:
    if not os.environ.get("POSTGRES_USER"):
        return False
    try:
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
        return True
    except Exception:
        return False


class ReviewApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not _postgres_available():
            raise unittest.SkipTest("No reachable Postgres; skipping review endpoint checks")
        ensure_learning_tables()
        ensure_review_tables()

        app = FastAPI()
        app.include_router(learning_router)
        app.include_router(review_router)
        # Guests never touch Auth0 settings; this keeps the tests independent of them.
        app.dependency_overrides[get_auth_settings] = lambda: object()
        cls.client = TestClient(app)

    def setUp(self):
        guest_uuid = str(uuid4())
        self.learner_id = f"guest:{guest_uuid}"
        self.headers = {"X-Guest-Id": guest_uuid}

        fake_graph = object()
        for module in (review_service, review_router_module):
            patcher = patch.multiple(
                module,
                get_learning_graph=lambda: fake_graph,
                get_concept=fake_get_concept,
            )
            patcher.start()
            self.addCleanup(patcher.stop)
        patcher = patch.multiple(
            review_service,
            get_source_context=fake_source_context,
            get_cached_learning_content=fake_cached_content,
            generate_flashcards=fake_generate_cards,
            cache_learning_content=lambda *args: None,
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def tearDown(self):
        with get_pool().connection() as conn, conn.cursor() as cur:
            for table in ("review_cards", "lesson_progress"):
                cur.execute(f"DELETE FROM {table} WHERE learner_id = %s", (self.learner_id,))
            conn.commit()

    def queue(self, **params):
        response = self.client.get("/learning/review/queue", params=params, headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def grade(self, card_id, grade):
        return self.client.post(
            "/learning/review/grade", json={"card_id": card_id, "grade": grade}, headers=self.headers
        )

    def open_lesson(self, concept_id, beat_index=0, beat_count=4):
        response = self.client.put(
            f"/learning/lesson/{concept_id}/progress",
            json={"beat_index": beat_index, "beat_count": beat_count},
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 204, response.text)


class ReviewQueueTests(ReviewApiTestCase):
    def test_a_new_guest_has_nothing_to_review(self):
        self.assertEqual(self.queue(), {"due_count": 0, "new_count": 0, "cards": []})

    def test_opening_a_lesson_makes_its_cards_reviewable(self):
        self.open_lesson("Reactivity")

        queue = self.queue()

        self.assertEqual((queue["due_count"], queue["new_count"]), (0, 4))
        first = queue["cards"][0]
        self.assertEqual(
            first,
            {
                "card_id": card_id("Reactivity", 0),
                "concept_id": "Reactivity",
                "concept_name": "Reactivity",
                "prompt": "Question 0 on Reactivity?",
                "answer": "Answer 0.",
                "source": "Published Source.pdf",
                "state": "new",
                "last_reviewed_at": None,
                "due_at": None,
                "intervals": {"again": 60, "hard": DAY, "good": DAY, "easy": 4 * DAY},
            },
        )
        self.assertEqual(queue["cards"][3]["answer"], "Answer 3.")

    def test_touched_concepts_without_a_cached_deck_generate_cards(self):
        self.open_lesson(UNCACHED)

        self.assertEqual(self.queue()["new_count"], 4)

    def test_a_deck_for_older_sources_is_regenerated(self):
        self.open_lesson(STALE)

        self.assertEqual(self.queue()["new_count"], 4)

    def test_new_cards_are_capped_per_request(self):
        for concept_id in CACHED:
            self.open_lesson(concept_id)

        queue = self.queue()

        self.assertEqual(queue["new_count"], 12)
        self.assertEqual(len(queue["cards"]), review_service.NEW_CARDS_PER_REQUEST)
        # The lesson opened last leads.
        self.assertEqual(queue["cards"][0]["concept_id"], "Reactor Period")

    def test_limit_bounds_the_cards_returned(self):
        self.open_lesson("Reactivity")

        self.assertEqual(len(self.queue(limit=2)["cards"]), 2)

    def test_concept_filter_serves_one_concept_even_if_untouched(self):
        self.open_lesson("Reactor")

        queue = self.queue(concept_id="Reactivity")

        self.assertEqual(queue["new_count"], 4)
        self.assertEqual({card["concept_id"] for card in queue["cards"]}, {"Reactivity"})

    def test_concept_filter_can_generate_a_new_deck(self):
        self.assertEqual(self.queue(concept_id=UNCACHED)["new_count"], 4)

    def test_overdue_cards_come_before_new_ones(self):
        self.open_lesson("Reactivity")
        record_grade(
            self.learner_id,
            card_id("Reactivity", 3),
            "Reactivity",
            "good",
            datetime.now(timezone.utc) - timedelta(days=2),
        )

        queue = self.queue()

        self.assertEqual((queue["due_count"], queue["new_count"]), (1, 3))
        due = queue["cards"][0]
        self.assertEqual(due["card_id"], card_id("Reactivity", 3))
        self.assertEqual(due["state"], "review")
        self.assertIsNotNone(due["last_reviewed_at"])
        self.assertEqual(due["intervals"]["good"], 3 * DAY)

    def test_bad_limits_are_rejected(self):
        for limit in (0, 101):
            with self.subTest(limit=limit):
                response = self.client.get(
                    "/learning/review/queue", params={"limit": limit}, headers=self.headers
                )
                self.assertEqual(response.status_code, 422)

    def test_a_learner_identity_is_required(self):
        self.assertEqual(self.client.get("/learning/review/queue").status_code, 401)


class ReviewGradeTests(ReviewApiTestCase):
    def test_grading_schedules_the_card_and_takes_it_out_of_the_queue(self):
        self.open_lesson("Reactivity")
        before = datetime.now(timezone.utc)

        response = self.grade(card_id("Reactivity", 0), "good")

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["card_id"], card_id("Reactivity", 0))
        self.assertEqual(body["interval_seconds"], DAY)
        self.assertEqual(body["state"], "review")
        due_at = datetime.fromisoformat(body["due_at"].replace("Z", "+00:00"))
        self.assertAlmostEqual((due_at - before).total_seconds(), DAY, delta=60)

        queue = self.queue()
        self.assertEqual((queue["due_count"], queue["new_count"]), (0, 3))
        self.assertNotIn(card_id("Reactivity", 0), [card["card_id"] for card in queue["cards"]])

    def test_again_puts_the_card_back_in_learning(self):
        body = self.grade(card_id("Reactivity", 1), "again").json()

        self.assertEqual((body["interval_seconds"], body["state"]), (60, "learning"))

    def test_invalid_bodies_are_rejected(self):
        for payload in (
            {"card_id": card_id("Reactivity", 0), "grade": "perfect"},
            {"card_id": card_id("Reactivity", 0)},
            {"grade": "good"},
            {"card_id": "", "grade": "good"},
        ):
            with self.subTest(payload=payload):
                response = self.client.post("/learning/review/grade", json=payload, headers=self.headers)
                self.assertEqual(response.status_code, 422)

    def test_unknown_cards_are_not_found(self):
        for unknown_id in (
            "nonsense",
            "Reactivity::summary",
            make_card_id("Reactivity", "1234567890abcdef" * 4, 0),
            card_id("Not A Concept", 0),
        ):
            with self.subTest(card_id=unknown_id):
                self.assertEqual(self.grade(unknown_id, "good").status_code, 404)

    def test_a_rejected_grade_saves_nothing(self):
        self.grade(make_card_id("Reactivity", "1234567890abcdef" * 4, 0), "good")

        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM review_cards WHERE learner_id = %s", (self.learner_id,))
            self.assertEqual(cur.fetchone()[0], 0)


class LessonProgressTests(ReviewApiTestCase):
    def test_progress_is_saved(self):
        self.open_lesson("Reactivity", beat_index=2, beat_count=4)

        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT beat_index, beat_count FROM lesson_progress WHERE learner_id = %s AND concept_id = %s",
                (self.learner_id, "Reactivity"),
            )
            self.assertEqual(cur.fetchone(), (2, 4))

    def test_out_of_range_positions_are_rejected(self):
        for payload in (
            {"beat_index": 4, "beat_count": 4},
            {"beat_index": -1, "beat_count": 4},
            {"beat_index": 0, "beat_count": 0},
            {"beat_index": 0, "beat_count": 11},
            {"beat_index": 0},
        ):
            with self.subTest(payload=payload):
                response = self.client.put(
                    "/learning/lesson/Reactivity/progress", json=payload, headers=self.headers
                )
                self.assertEqual(response.status_code, 422)

    def test_unknown_concepts_are_not_found(self):
        response = self.client.put(
            "/learning/lesson/Not A Concept/progress",
            json={"beat_index": 0, "beat_count": 4},
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 404)


class DashboardTests(ReviewApiTestCase):
    def setUp(self):
        super().setUp()
        # The dashboard's own concept list; mastery stays real (empty for a new guest).
        patcher = patch.multiple(
            "src.learning.router",
            get_learning_graph=lambda: object(),
            list_concepts=lambda graph, limit: [fake_get_concept(None, "Reactivity")],
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def dashboard(self):
        response = self.client.get("/learning/dashboard", headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_a_new_guest_has_nothing_due_and_nothing_to_resume(self):
        body = self.dashboard()

        self.assertEqual(body["review"], {"due_count": 0, "new_count": 0})
        self.assertIsNone(body["last_lesson"])

    def test_existing_fields_are_unchanged(self):
        body = self.dashboard()

        self.assertEqual(body["total_concepts"], 1)
        self.assertEqual(body["started_concepts"], 0)
        self.assertEqual(body["recommended"]["concept"]["id"], "Reactivity")
        self.assertEqual(body["recommended"]["reason"], "Recommended starting point")
        self.assertEqual(len(body["concepts"]), 1)

    def test_review_counts_match_the_queue(self):
        self.open_lesson("Reactivity", beat_index=2)
        self.grade(card_id("Reactivity", 0), "good")
        record_grade(
            self.learner_id,
            card_id("Reactivity", 3),
            "Reactivity",
            "good",
            datetime.now(timezone.utc) - timedelta(days=2),
        )

        body = self.dashboard()
        queue = self.queue()

        self.assertEqual(body["review"], {"due_count": 1, "new_count": 2})
        self.assertEqual(body["review"], {"due_count": queue["due_count"], "new_count": queue["new_count"]})

    def test_last_lesson_is_the_one_touched_most_recently(self):
        self.open_lesson("Reactivity", beat_index=3)
        self.open_lesson("Reactor Period", beat_index=1)

        last = self.dashboard()["last_lesson"]

        self.assertEqual(
            {key: last[key] for key in ("concept_id", "concept_name", "beat_index", "beat_count")},
            {
                "concept_id": "Reactor Period",
                "concept_name": "Reactor Period",
                "beat_index": 1,
                "beat_count": 4,
            },
        )
        self.assertIsNotNone(datetime.fromisoformat(last["updated_at"].replace("Z", "+00:00")))


if __name__ == "__main__":
    unittest.main()
