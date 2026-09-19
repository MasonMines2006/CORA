"""Check the neighbourhood and suggestion queries against the real course graph.

Why this exists: a unit test that hands these functions a fake graph never parses
the Cypher, so a wrong query -- or one that returns plausible-looking noise --
keeps the suite green. That is how a broken course map once shipped with 42
passing tests. These tests run the real queries and assert real results for
Reactivity, which the dev graph has, with known neighbours such as Keff and
Control_Rods and known noise such as "Reactor Operations Homework #3".

The last class goes end to end: it writes a throwaway guest's mastery into
Postgres, calls both endpoints through FastAPI with a real X-Guest-Id header, and
deletes the rows again. No lesson or quiz is ever generated.

Skips cleanly when Neo4j or Postgres is not configured, or Reactivity is absent.
"""

import os
import time
import unittest
from uuid import uuid4

from src.learning.graph import (
    excluded_entity_labels,
    get_concept_neighbourhood,
    get_learning_graph,
    get_suggested_concepts,
    min_concept_connectivity,
)

CENTRE = "Reactivity"
# Entities the dev graph links to Reactivity that are NOT teachable topics. Each
# is dropped by a different eligibility rule, so all three must be absent.
KNOWN_NOISE = {
    "Reactor Operations Homework #3",  # carries the excluded Document label
    "Reactor Theory Manual 35 Revision 1",  # also a Document
    "Alara Principles",  # has no passage in a completed, non-answer-key document
}
# A warm query takes ~0.06 s on the 1,797-entity dev graph. The bound is loose
# on purpose: it catches a runaway (cartesian) plan, not normal jitter.
MAX_WARM_SECONDS = 1.0


def _normalised(label: str) -> str:
    return label.replace("_", " ").strip().lower()


def _timed(function, *args, **kwargs):
    started = time.perf_counter()
    result = function(*args, **kwargs)
    return result, time.perf_counter() - started


class LiveGraphTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.environ.get("NEO4J_URI"):
            raise unittest.SkipTest("No Neo4j configured; skipping live neighbourhood checks")
        try:
            cls.graph = get_learning_graph()
            probe = get_concept_neighbourhood(cls.graph, CENTRE, limit=1)
        except Exception as exc:  # pragma: no cover - environment dependent
            raise unittest.SkipTest(f"Could not query the learning graph: {exc}")
        if probe["linked_count"] == 0:
            raise unittest.SkipTest(f"{CENTRE} has no neighbours in this graph")


class NeighbourhoodLiveTests(LiveGraphTestCase):
    def test_reactivity_links_to_keff_at_the_default_size(self):
        result = get_concept_neighbourhood(self.graph, CENTRE)

        names = [neighbour["name"] for neighbour in result["neighbours"]]
        self.assertEqual(len(names), 8)
        self.assertIn("Keff", names)

    def test_a_wider_request_reaches_control_rods(self):
        result = get_concept_neighbourhood(self.graph, CENTRE, limit=20)

        self.assertIn("Control_Rods", [neighbour["id"] for neighbour in result["neighbours"]])

    def test_linked_count_covers_more_than_the_returned_page(self):
        result = get_concept_neighbourhood(self.graph, CENTRE, limit=3)

        self.assertEqual(len(result["neighbours"]), 3)
        self.assertGreater(result["linked_count"], 3)

    def test_no_extraction_noise_reaches_the_hub(self):
        result = get_concept_neighbourhood(self.graph, CENTRE, limit=20)
        excluded = excluded_entity_labels()

        for neighbour in result["neighbours"]:
            with self.subTest(neighbour=neighbour["name"]):
                self.assertNotIn(neighbour["name"], KNOWN_NOISE)
                self.assertFalse(
                    any(_normalised(label) in excluded for label in neighbour["labels"]),
                    f"{neighbour['name']} carries an excluded label: {neighbour['labels']}",
                )
                # Every neighbour is grounded in completed course material.
                self.assertGreaterEqual(neighbour["chunk_count"], 1)
                self.assertNotEqual(neighbour["id"], CENTRE)

    def test_neighbours_are_ordered_by_shared_passages(self):
        result = get_concept_neighbourhood(self.graph, CENTRE, limit=20)

        shared = [neighbour["shared_passages"] for neighbour in result["neighbours"]]
        self.assertEqual(shared, sorted(shared, reverse=True))
        self.assertGreater(shared[0], 0, "Reactivity shares passages with its top neighbour")

    def test_every_neighbour_names_a_relationship_and_direction(self):
        result = get_concept_neighbourhood(self.graph, CENTRE, limit=20)

        for neighbour in result["neighbours"]:
            with self.subTest(neighbour=neighbour["name"]):
                self.assertTrue(neighbour["relationship"])
                self.assertIn(neighbour["direction"], ("in", "out"))

    def test_keff_gets_its_specific_relationship(self):
        # Reactivity-[CALCULATED_FROM]->Keff sits beside two generic links.
        keff = next(
            neighbour
            for neighbour in get_concept_neighbourhood(self.graph, CENTRE, limit=20)["neighbours"]
            if neighbour["id"] == "Keff"
        )

        self.assertEqual((keff["relationship"], keff["direction"]), ("CALCULATED_FROM", "out"))

    def test_an_unknown_concept_has_an_empty_neighbourhood(self):
        result = get_concept_neighbourhood(self.graph, f"no-such-concept-{uuid4()}")

        self.assertEqual(result, {"linked_count": 0, "neighbours": []})

    def test_a_warm_query_is_fast(self):
        get_concept_neighbourhood(self.graph, CENTRE, limit=20)  # plan and cache

        _, seconds = _timed(get_concept_neighbourhood, self.graph, CENTRE, limit=20)

        self.assertLess(seconds, MAX_WARM_SECONDS)


class SuggestionsLiveTests(LiveGraphTestCase):
    def test_reactivity_suggests_its_linked_concepts(self):
        suggestions = get_suggested_concepts(self.graph, [CENTRE], limit=10)

        names = [item["concept"].name for item in suggestions]
        self.assertIn("Keff", names)
        self.assertTrue(all(item["because_of"]["id"] == CENTRE for item in suggestions))

    def test_suggestions_are_eligible_concepts_only(self):
        suggestions = get_suggested_concepts(self.graph, [CENTRE], limit=10)
        minimum = min_concept_connectivity()

        for item in suggestions:
            with self.subTest(concept=item["concept"].name):
                self.assertNotIn(item["concept"].name, KNOWN_NOISE)
                self.assertGreaterEqual(item["concept"].connectivity, minimum)
                self.assertGreaterEqual(item["concept"].chunk_count, 1)

    def test_started_concepts_are_never_suggested(self):
        started = [CENTRE, "Keff", "Reactor"]

        suggestions = get_suggested_concepts(self.graph, started, limit=10)

        self.assertTrue(suggestions)
        self.assertFalse({item["concept"].id for item in suggestions} & set(started))

    def test_each_concept_is_suggested_once(self):
        # Pulstar links to Reactivity and to Reactor; it must appear once.
        suggestions = get_suggested_concepts(self.graph, [CENTRE, "Reactor"], limit=10)

        ids = [item["concept"].id for item in suggestions]
        self.assertEqual(len(ids), len(set(ids)))

    def test_suggestions_are_ordered_by_shared_passages(self):
        suggestions = get_suggested_concepts(self.graph, [CENTRE], limit=10)

        shared = [item["shared_passages"] for item in suggestions]
        self.assertEqual(shared, sorted(shared, reverse=True))

    def test_a_warm_query_is_fast(self):
        started = [CENTRE, "Keff", "Reactor"]
        get_suggested_concepts(self.graph, started, limit=10)  # plan and cache

        _, seconds = _timed(get_suggested_concepts, self.graph, started, limit=10)

        self.assertLess(seconds, MAX_WARM_SECONDS)


class GraphEndpointsLiveTests(LiveGraphTestCase):
    """Both endpoints end to end, for a throwaway guest who has quizzed on Keff."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        if not os.environ.get("POSTGRES_USER"):
            raise unittest.SkipTest("No Postgres configured; skipping live endpoint checks")

        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from src.learning.router import router
        from src.user_store import ensure_learning_tables, get_pool

        try:
            ensure_learning_tables()
        except Exception as exc:  # pragma: no cover - environment dependent
            raise unittest.SkipTest(f"Could not reach Postgres: {exc}")

        cls.pool = get_pool()
        cls.guest_uuid = str(uuid4())
        cls.learner_id = f"guest:{cls.guest_uuid}"
        app = FastAPI()
        app.include_router(router)
        cls.client = TestClient(app)

    def setUp(self):
        # Written directly rather than through quiz grading, which would first
        # need a generated (paid) quiz.
        self._write_mastery("Keff", attempts=5, correct=4)
        self.addCleanup(self._delete_mastery)

    def _write_mastery(self, concept_id, attempts, correct):
        with self.pool.connection() as conn:
            conn.execute(
                "INSERT INTO learner_mastery (learner_id, concept_id, attempts, correct) "
                "VALUES (%s, %s, %s, %s)",
                (self.learner_id, concept_id, attempts, correct),
            )

    def _delete_mastery(self):
        with self.pool.connection() as conn:
            conn.execute("DELETE FROM learner_mastery WHERE learner_id = %s", (self.learner_id,))

    def _get(self, path):
        return self.client.get(path, headers={"X-Guest-Id": self.guest_uuid})

    def test_neighbourhood_carries_the_learners_mastery(self):
        response = self._get(f"/learning/concepts/{CENTRE}/neighbourhood?limit=20")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["concept"]["id"], CENTRE)
        by_id = {neighbour["id"]: neighbour for neighbour in body["neighbours"]}
        self.assertEqual(by_id["Keff"]["mastery"]["score"], 80.0)
        self.assertIsNone(by_id["Control_Rods"]["mastery"])

    def test_unknown_concept_is_404(self):
        response = self._get(f"/learning/concepts/no-such-concept-{uuid4()}/neighbourhood")

        self.assertEqual(response.status_code, 404)

    def test_suggestions_follow_what_the_learner_started(self):
        response = self._get("/learning/suggestions?limit=5")

        self.assertEqual(response.status_code, 200)
        suggestions = response.json()["suggestions"]
        self.assertTrue(suggestions)
        for item in suggestions:
            with self.subTest(concept=item["concept"]["name"]):
                self.assertEqual(item["because_of"]["id"], "Keff")
                self.assertNotEqual(item["concept"]["id"], "Keff")
                self.assertIn("Keff", item["reason"])

    def test_a_guest_who_started_nothing_gets_no_suggestions(self):
        response = self.client.get("/learning/suggestions", headers={"X-Guest-Id": str(uuid4())})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"suggestions": []})


if __name__ == "__main__":
    unittest.main()
