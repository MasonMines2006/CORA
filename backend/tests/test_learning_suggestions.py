"""Home's "Suggested next" list: concepts linked to what the learner has
started, that they have not started yet (docs/artboards/README.md, "1. Home").

These tests pin the Python shaping with a fake graph. The Cypher itself is
covered by test_learning_cypher_syntax.py (EXPLAIN) and
test_learning_neighbourhood_live.py (real suggestions from Reactivity).
"""

import unittest

from src.learning.graph import (
    _LABEL_FILTER_CLAUSE,
    _SUGGESTED_CONCEPTS_QUERY,
    get_suggested_concepts,
)
from src.learning.models import ConceptSuggestions
from src.learning.service import build_suggestions, suggestion_reason


class FakeGraph:
    """Records the Cypher and params it is given and replays canned rows."""

    def __init__(self, rows):
        self.rows = rows
        self.calls = 0
        self.last_params = None

    def query(self, query, params=None):
        self.calls += 1
        self.last_params = params or {}
        return self.rows


def suggestion_row(name, because_of, links, shared_passages):
    return {
        "id": name,
        "name": name,
        "chunk_count": 9,
        "document_count": 6,
        "connectivity": 50,
        "sources": ["Theory Manual - NE235.pdf"],
        "because_of": {
            "id": because_of,
            "name": because_of,
            "links": links,
            "shared_passages": shared_passages,
        },
    }


def rows_after_reactivity():
    return [
        suggestion_row(
            "Keff",
            "Reactivity",
            [
                {"type": "RELATED_TO", "direction": "in"},
                {"type": "CALCULATED_FROM", "direction": "in"},
            ],
            shared_passages=3,
        ),
        suggestion_row(
            "Burnout",
            "Reactivity",
            [{"type": "RELATED_TO", "direction": "out"}],
            shared_passages=0,
        ),
    ]


class SuggestedConceptsQueryTests(unittest.TestCase):
    def test_a_learner_who_started_nothing_gets_nothing_without_a_query(self):
        graph = FakeGraph(rows_after_reactivity())

        self.assertEqual(get_suggested_concepts(graph, [], limit=3), [])
        self.assertEqual(graph.calls, 0)

    def test_sends_started_ids_limit_and_eligibility_params(self):
        graph = FakeGraph([])

        get_suggested_concepts(graph, ["Reactivity", "Keff"], limit=4)

        self.assertEqual(graph.last_params["started_ids"], ["Reactivity", "Keff"])
        self.assertEqual(graph.last_params["limit"], 4)
        self.assertIn("document", graph.last_params["excluded_labels"])
        self.assertIn("min_connectivity", graph.last_params)

    def test_rows_become_concepts_with_their_strongest_link(self):
        keff = get_suggested_concepts(FakeGraph(rows_after_reactivity()), ["Reactivity"])[0]

        self.assertEqual(keff["concept"].id, "Keff")
        self.assertEqual(keff["concept"].connectivity, 50)
        self.assertEqual(keff["concept"].sources, ["Theory Manual - NE235.pdf"])
        self.assertEqual(keff["because_of"], {"id": "Reactivity", "name": "Reactivity"})
        self.assertEqual(keff["relationship"], "CALCULATED_FROM")
        self.assertEqual(keff["shared_passages"], 3)

    def test_uses_the_shared_eligibility_rules(self):
        self.assertIn(_LABEL_FILTER_CLAUSE, _SUGGESTED_CONCEPTS_QUERY)
        self.assertIn("document.status = 'Completed'", _SUGGESTED_CONCEPTS_QUERY)
        self.assertIn("connectivity >= $min_connectivity", _SUGGESTED_CONCEPTS_QUERY)

    def test_never_suggests_something_already_started(self):
        self.assertIn("NOT coalesce(", _SUGGESTED_CONCEPTS_QUERY)
        self.assertIn("IN $started_ids", _SUGGESTED_CONCEPTS_QUERY)


class SuggestionReasonTests(unittest.TestCase):
    def test_shared_passages_are_the_reason_when_there_are_any(self):
        self.assertEqual(
            suggestion_reason("Reactivity", "RELATED_TO", 4),
            "Appears with Reactivity in 4 passages",
        )

    def test_one_passage_is_singular(self):
        self.assertEqual(
            suggestion_reason("Reactivity", "RELATED_TO", 1),
            "Appears with Reactivity in 1 passage",
        )

    def test_without_shared_passages_the_link_itself_is_the_reason(self):
        self.assertEqual(
            suggestion_reason("Reactivity", "RELATED_TO", 0),
            "Linked to Reactivity (RELATED_TO)",
        )


class BuildSuggestionsTests(unittest.TestCase):
    def test_builds_the_response_model_with_reasons(self):
        items = get_suggested_concepts(FakeGraph(rows_after_reactivity()), ["Reactivity"])

        result = build_suggestions(items)

        self.assertIsInstance(result, ConceptSuggestions)
        self.assertEqual(
            [item.reason for item in result.suggestions],
            ["Appears with Reactivity in 3 passages", "Linked to Reactivity (RELATED_TO)"],
        )
        self.assertEqual(result.suggestions[0].because_of.name, "Reactivity")

    def test_no_items_is_an_empty_list_not_an_error(self):
        self.assertEqual(build_suggestions([]).model_dump(), {"suggestions": []})


if __name__ == "__main__":
    unittest.main()
