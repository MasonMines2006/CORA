"""HTTP behaviour of the neighbourhood and suggestions endpoints.

The graph and Postgres calls are patched out, so this pins what the router adds
on top of them: the 404, the mastery join, the empty-learner case, and that a
concept id containing "/" (30 of them exist, e.g. "Cr2/Cr1") still routes.
"""

import importlib
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.auth import get_learner
from src.learning.models import Concept

# `from src.learning import router` would hand back the APIRouter object, because
# src/learning/__init__.py re-exports it under the submodule's name. The patches
# below need the module itself.
router_module = importlib.import_module("src.learning.router")

LEARNER_ID = "guest:00000000-0000-4000-8000-000000000000"


def concept(concept_id="Reactivity"):
    return Concept(
        id=concept_id, name=concept_id, chunk_count=16, document_count=7, connectivity=54
    )


def neighbourhood():
    return {
        "linked_count": 2,
        "neighbours": [
            {
                "id": "Keff",
                "name": "Keff",
                "labels": ["Concept"],
                "chunk_count": 9,
                "relationship": "CALCULATED_FROM",
                "direction": "out",
                "shared_passages": 3,
            },
            {
                "id": "Criticality",
                "name": "Criticality",
                "labels": ["Concept"],
                "chunk_count": 5,
                "relationship": "RELATED_TO",
                "direction": "in",
                "shared_passages": 2,
            },
        ],
    }


class GraphRouteTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router_module.router)
        app.dependency_overrides[get_learner] = lambda: {"learner_id": LEARNER_ID, "role": "guest"}
        self.client = TestClient(app)

        # The graph client is never opened; the query functions are patched.
        patcher = patch.object(router_module, "get_learning_graph", return_value=object())
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_neighbourhood_joins_mastery_in_the_same_request(self):
        with (
            patch.object(router_module, "get_concept", return_value=concept()),
            patch.object(router_module, "get_concept_neighbourhood", return_value=neighbourhood()),
            patch.object(
                router_module, "list_mastery", return_value={"Keff": {"attempts": 5, "correct": 4}}
            ) as list_mastery,
        ):
            response = self.client.get("/learning/concepts/Reactivity/neighbourhood?limit=2")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["concept"]["id"], "Reactivity")
        self.assertEqual(body["linked_count"], 2)
        self.assertEqual(body["neighbours"][0]["mastery"]["score"], 80.0)
        self.assertIsNone(body["neighbours"][1]["mastery"])
        list_mastery.assert_called_once_with(LEARNER_ID)

    def test_unknown_concept_is_404_not_503(self):
        with (
            patch.object(router_module, "get_concept", return_value=None),
            patch.object(router_module, "get_concept_neighbourhood", return_value={"linked_count": 0, "neighbours": []}),
            patch.object(router_module, "list_mastery", return_value={}),
        ):
            response = self.client.get("/learning/concepts/Nope/neighbourhood")

        self.assertEqual(response.status_code, 404)

    def test_a_concept_id_containing_a_slash_still_routes(self):
        with (
            patch.object(router_module, "get_concept", return_value=concept("Cr2/Cr1")) as get_concept,
            patch.object(router_module, "get_concept_neighbourhood", return_value={"linked_count": 0, "neighbours": []}),
            patch.object(router_module, "list_mastery", return_value={}),
        ):
            response = self.client.get("/learning/concepts/Cr2%2FCr1/neighbourhood")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(get_concept.call_args.args[1], "Cr2/Cr1")

    def test_neighbourhood_limit_is_bounded(self):
        for limit in (0, 21):
            with self.subTest(limit=limit):
                response = self.client.get(f"/learning/concepts/Reactivity/neighbourhood?limit={limit}")
                self.assertEqual(response.status_code, 422)

    def test_neighbourhood_graph_failure_is_503(self):
        with (
            patch.object(router_module, "get_concept", side_effect=RuntimeError("neo4j down")),
            patch.object(router_module, "get_concept_neighbourhood", return_value={"linked_count": 0, "neighbours": []}),
            patch.object(router_module, "list_mastery", return_value={}),
        ):
            response = self.client.get("/learning/concepts/Reactivity/neighbourhood")

        self.assertEqual(response.status_code, 503)

    def test_suggestions_for_a_learner_who_started_nothing_is_empty(self):
        with (
            patch.object(router_module, "list_touched_concepts", return_value=[]),
            patch.object(router_module, "get_suggested_concepts") as get_suggested,
        ):
            response = self.client.get("/learning/suggestions")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"suggestions": []})
        get_suggested.assert_not_called()

    def test_reading_a_lesson_is_enough_to_be_suggested_from(self):
        # list_touched_concepts counts a lesson position and a graded card, not
        # just a quiz. Keying suggestions off mastery alone left Home's
        # "Suggested next" empty for anyone who had only read lessons.
        with (
            patch.object(router_module, "list_touched_concepts", return_value=["Reactivity"]) as touched,
            patch.object(router_module, "get_suggested_concepts", return_value=[]) as get_suggested,
        ):
            response = self.client.get("/learning/suggestions")

        self.assertEqual(response.status_code, 200)
        touched.assert_called_once_with(LEARNER_ID)
        self.assertEqual(get_suggested.call_args.args[1:], (["Reactivity"], 3))

    def test_suggestions_pass_started_concepts_and_explain_themselves(self):
        suggested = [
            {
                "concept": concept("Keff"),
                "because_of": {"id": "Reactivity", "name": "Reactivity"},
                "relationship": "CALCULATED_FROM",
                "shared_passages": 3,
            }
        ]
        with (
            patch.object(router_module, "list_touched_concepts", return_value=["Reactivity"]),
            patch.object(router_module, "get_suggested_concepts", return_value=suggested) as get_suggested,
        ):
            response = self.client.get("/learning/suggestions?limit=2")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(get_suggested.call_args.args[1:], (["Reactivity"], 2))
        item = response.json()["suggestions"][0]
        self.assertEqual(item["concept"]["id"], "Keff")
        self.assertEqual(item["because_of"], {"id": "Reactivity", "name": "Reactivity"})
        self.assertEqual(item["reason"], "Appears with Reactivity in 3 passages")

    def test_suggestions_limit_is_bounded(self):
        for limit in (0, 11):
            with self.subTest(limit=limit):
                self.assertEqual(self.client.get(f"/learning/suggestions?limit={limit}").status_code, 422)


if __name__ == "__main__":
    unittest.main()
