"""Every learning endpoint, run against a graph where nothing is published.

The acceptance example in the product requirements: a topic that exists only in
an unpublished document must not be findable in concepts, the graph, lessons,
quizzes, sources, cards or suggestions -- even by a student who types its id
into the URL.

The real routers and the real query functions run here. Only the Neo4j client
is replaced, by a fake that records every Cypher string and returns no rows
(which is what the published filter yields for a draft-only concept), and
Postgres and the LLM are patched out. So each test checks two things at once:
the endpoint refuses or comes back empty, and every query it ran on the way
carried the shared published-document predicate.
"""

import importlib
import re
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.auth import get_learner
from src.learning import review_router as review_router_module
from src.learning import review_service
from src.shared.published_corpus import published_document

# `from src.learning import router` returns the APIRouter, not the module.
router_module = importlib.import_module("src.learning.router")

DRAFT_ONLY_CONCEPT = "Draft Only Topic"
LEARNER = {"learner_id": "guest:00000000-0000-4000-8000-000000000000", "role": "guest"}
_DOCUMENT_BINDING = re.compile(r"\((\w+):Document\b")


class RecordingGraph:
    """A Neo4j stand-in for a database whose matching material is all draft."""

    def __init__(self):
        self.queries = []

    def query(self, query, params=None):
        self.queries.append(query)
        return []


async def _no_llm(*_args, **_kwargs):
    raise AssertionError("No content may be generated for unpublished material")


class DraftOnlyRouteTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router_module.router)
        app.include_router(review_router_module.router)
        app.dependency_overrides[get_learner] = lambda: LEARNER
        self.client = TestClient(app)
        self.graph = RecordingGraph()

        patches = [
            patch.object(module, "get_learning_graph", return_value=self.graph)
            for module in (router_module, review_service, review_router_module)
        ]
        patches += [
            # Postgres: a learner who has started the draft-only concept.
            patch.object(router_module, "list_mastery", return_value={}),
            patch.object(router_module, "get_mastery", return_value=None),
            patch.object(router_module, "list_touched_concepts", return_value=[DRAFT_ONLY_CONCEPT]),
            patch.object(router_module, "get_cached_learning_content", return_value=None),
            patch.object(review_service, "list_touched_concepts", return_value=[DRAFT_ONLY_CONCEPT]),
            patch.object(review_service, "list_card_states", return_value={}),
            patch.object(review_service, "get_last_lesson", return_value=None),
            patch.object(review_service, "get_cached_learning_content", return_value=None),
            patch.object(review_router_module, "save_lesson_progress"),
            # LLM: must never be reached.
            patch.object(router_module, "generate_lesson", _no_llm),
            patch.object(router_module, "generate_quiz", _no_llm),
            patch.object(review_service, "generate_flashcards", _no_llm),
        ]
        for patcher in patches:
            patcher.start()
            self.addCleanup(patcher.stop)

    def assert_every_query_was_published_only(self):
        self.assertTrue(self.graph.queries, "the endpoint never asked the graph")
        for query in self.graph.queries:
            for variable in set(_DOCUMENT_BINDING.findall(query)):
                self.assertIn(published_document(variable), query)

    def test_content_endpoints_refuse_a_draft_only_concept(self):
        requests = [
            ("get", f"/learning/lesson/{DRAFT_ONLY_CONCEPT}", None),
            ("get", f"/learning/sources/{DRAFT_ONLY_CONCEPT}", None),
            ("get", f"/learning/concepts/{DRAFT_ONLY_CONCEPT}/neighbourhood", None),
            ("post", "/learning/quiz/generate", {"concept_id": DRAFT_ONLY_CONCEPT}),
            ("put", f"/learning/lesson/{DRAFT_ONLY_CONCEPT}/progress", {"beat_index": 0, "beat_count": 4}),
        ]
        for method, path, body in requests:
            with self.subTest(path=path):
                self.graph.queries.clear()
                send = getattr(self.client, method)
                response = send(path, json=body) if body else send(path)
                self.assertEqual(response.status_code, 404, response.text)
                self.assert_every_query_was_published_only()

    def test_listing_endpoints_show_nothing_from_drafts(self):
        cases = {
            "/learning/concepts": lambda body: self.assertEqual(body, []),
            "/learning/network": lambda body: self.assertEqual(body["nodes"], []),
            "/learning/suggestions": lambda body: self.assertEqual(body["suggestions"], []),
            "/learning/dashboard": lambda body: self.assertEqual(body["concepts"], []),
        }
        for path, check in cases.items():
            with self.subTest(path=path):
                self.graph.queries.clear()
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200, response.text)
                check(response.json())
                self.assert_every_query_was_published_only()

    def test_review_cards_are_not_made_from_drafts(self):
        for params in ({}, {"concept_id": DRAFT_ONLY_CONCEPT}):
            with self.subTest(params=params):
                self.graph.queries.clear()
                response = self.client.get("/learning/review/queue", params=params)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()["cards"], [])
                self.assert_every_query_was_published_only()

    def test_a_card_id_for_a_draft_concept_cannot_be_graded(self):
        card_id = f"{DRAFT_ONLY_CONCEPT}::0123456789abcdef::0"
        response = self.client.post("/learning/review/grade", json={"card_id": card_id, "grade": "good"})
        self.assertEqual(response.status_code, 404, response.text)
        self.assert_every_query_was_published_only()


if __name__ == "__main__":
    unittest.main()
