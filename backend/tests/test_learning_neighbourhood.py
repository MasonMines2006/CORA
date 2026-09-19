"""One concept's neighbourhood, for the concept hub's Graph mode and its
"Linked concepts" rail (docs/artboards/README.md, "2. Concept hub").

The course map (`/learning/network`) only draws the top 120 concepts, so a
concept outside that set would show no neighbours at all. This query walks one
hop out from a single concept instead.

These tests pin the Python shaping with a fake graph. A fake never parses the
Cypher, so the query itself is covered by test_learning_cypher_syntax.py (EXPLAIN)
and test_learning_neighbourhood_live.py (real results for Reactivity).
"""

import unittest

from src.learning.graph import (
    _CONCEPT_NEIGHBOURHOOD_QUERY,
    _LABEL_FILTER_CLAUSE,
    get_concept_neighbourhood,
    pick_relationship,
)
from src.learning.models import Concept, ConceptNeighbourhood
from src.learning.service import attach_neighbour_mastery


class FakeGraph:
    """Records the Cypher and params it is given and replays canned rows."""

    def __init__(self, rows):
        self.rows = rows
        self.last_query = None
        self.last_params = None

    def query(self, query, params=None):
        self.last_query = query
        self.last_params = params or {}
        return self.rows


def neighbour_row(name, links, shared_passages=0, connectivity=10):
    return {
        "id": name,
        "name": name,
        "labels": ["Concept"],
        "chunk_count": 5,
        "connectivity": connectivity,
        "shared_passages": shared_passages,
        "links": links,
    }


def reactivity_rows():
    return [
        {
            "linked_count": 25,
            "neighbours": [
                neighbour_row(
                    "Keff",
                    [
                        {"type": "RELATED_TO", "direction": "out"},
                        {"type": "CALCULATED_FROM", "direction": "out"},
                        {"type": "ASSOCIATED_WITH", "direction": "in"},
                    ],
                    shared_passages=3,
                ),
                neighbour_row(
                    "Criticality",
                    [{"type": "RELATED_TO", "direction": "in"}],
                    shared_passages=2,
                ),
            ],
        }
    ]


class NeighbourhoodShapingTests(unittest.TestCase):
    def test_sends_the_concept_limit_and_eligibility_params(self):
        graph = FakeGraph(reactivity_rows())

        get_concept_neighbourhood(graph, "Reactivity", limit=6)

        self.assertEqual(graph.last_params["concept_id"], "Reactivity")
        self.assertEqual(graph.last_params["limit"], 6)
        self.assertIn("document", graph.last_params["excluded_labels"])
        self.assertIn("min_connectivity", graph.last_params)

    def test_linked_count_is_all_eligible_neighbours_not_just_returned_ones(self):
        result = get_concept_neighbourhood(FakeGraph(reactivity_rows()), "Reactivity", limit=2)

        self.assertEqual(result["linked_count"], 25)
        self.assertEqual(len(result["neighbours"]), 2)

    def test_neighbours_carry_the_fields_the_hub_draws(self):
        keff = get_concept_neighbourhood(FakeGraph(reactivity_rows()), "Reactivity")["neighbours"][0]

        self.assertEqual(keff["id"], "Keff")
        self.assertEqual(keff["name"], "Keff")
        self.assertEqual(keff["labels"], ["Concept"])
        self.assertEqual(keff["chunk_count"], 5)
        self.assertEqual(keff["shared_passages"], 3)
        # The raw link list is an implementation detail of the query.
        self.assertNotIn("links", keff)

    def test_a_specific_relationship_beats_a_generic_one(self):
        # Reactivity and Keff are joined three ways in the real graph.
        # CALCULATED_FROM says something; RELATED_TO only says "connected".
        keff = get_concept_neighbourhood(FakeGraph(reactivity_rows()), "Reactivity")["neighbours"][0]

        self.assertEqual(keff["relationship"], "CALCULATED_FROM")
        self.assertEqual(keff["direction"], "out")

    def test_direction_follows_the_chosen_relationship(self):
        criticality = get_concept_neighbourhood(FakeGraph(reactivity_rows()), "Reactivity")["neighbours"][1]

        self.assertEqual(criticality["relationship"], "RELATED_TO")
        self.assertEqual(criticality["direction"], "in")

    def test_no_rows_is_an_empty_neighbourhood(self):
        result = get_concept_neighbourhood(FakeGraph([]), "Nothing")

        self.assertEqual(result, {"linked_count": 0, "neighbours": []})

    def test_result_validates_against_the_response_model(self):
        result = get_concept_neighbourhood(FakeGraph(reactivity_rows()), "Reactivity")
        concept = Concept(
            id="Reactivity", name="Reactivity", chunk_count=16, document_count=7, connectivity=54
        )

        model = ConceptNeighbourhood(concept=concept, **result)

        self.assertEqual(model.neighbours[0].relationship, "CALCULATED_FROM")


class PickRelationshipTests(unittest.TestCase):
    def test_choice_is_deterministic_among_specific_types(self):
        links = [
            {"type": "HAS_PROPERTY", "direction": "in"},
            {"type": "AFFECTS", "direction": "in"},
        ]

        self.assertEqual(pick_relationship(links)["type"], "AFFECTS")
        self.assertEqual(pick_relationship(list(reversed(links)))["type"], "AFFECTS")

    def test_every_generic_spelling_in_the_graph_ranks_last(self):
        for generic in ("RELATED_TO", "RELATEDTO", "IS_RELATED_TO", "ASSOCIATED_WITH", "CONNECTED_TO"):
            with self.subTest(generic=generic):
                links = [{"type": generic, "direction": "out"}, {"type": "USES", "direction": "in"}]
                self.assertEqual(pick_relationship(links)["type"], "USES")

    def test_same_type_both_ways_prefers_outgoing(self):
        links = [
            {"type": "RELATED_TO", "direction": "in"},
            {"type": "RELATED_TO", "direction": "out"},
        ]

        self.assertEqual(pick_relationship(links)["direction"], "out")

    def test_missing_links_fall_back_to_a_plain_link(self):
        self.assertEqual(pick_relationship([]), {"type": "RELATED_TO", "direction": "out"})


class NeighbourhoodQueryShapeTests(unittest.TestCase):
    """The neighbours must pass the SAME rules as the concept list, or the hub
    would show "Reactor Operations Homework #3" as a linked concept."""

    def test_uses_the_shared_label_filter(self):
        self.assertIn(_LABEL_FILTER_CLAUSE, _CONCEPT_NEIGHBOURHOOD_QUERY)

    def test_requires_completed_non_answer_key_documents(self):
        self.assertIn("document.status = 'Completed'", _CONCEPT_NEIGHBOURHOOD_QUERY)
        self.assertIn("CONTAINS 'key'", _CONCEPT_NEIGHBOURHOOD_QUERY)

    def test_applies_the_minimum_connectivity(self):
        self.assertIn("connectivity >= $min_connectivity", _CONCEPT_NEIGHBOURHOOD_QUERY)

    def test_only_walks_to_entities_not_chunks(self):
        # Chunks hang off every concept via HAS_ENTITY; they are not neighbours.
        self.assertIn("(entity:__Entity__)", _CONCEPT_NEIGHBOURHOOD_QUERY)


class NeighbourMasteryTests(unittest.TestCase):
    def neighbourhood(self):
        result = get_concept_neighbourhood(FakeGraph(reactivity_rows()), "Reactivity")
        concept = Concept(
            id="Reactivity", name="Reactivity", chunk_count=16, document_count=7, connectivity=54
        )
        return ConceptNeighbourhood(concept=concept, **result)

    def test_attempted_neighbours_carry_their_mastery(self):
        rows = {"Keff": {"attempts": 5, "correct": 4}}

        result = attach_neighbour_mastery(self.neighbourhood(), rows)

        self.assertEqual(result.neighbours[0].mastery.score, 80.0)
        self.assertEqual(result.neighbours[0].mastery.concept_id, "Keff")

    def test_never_attempted_neighbours_have_no_mastery(self):
        # The "Linked concepts" rail draws an em-dash for these, so null is the
        # honest value -- unlike the course map, which colours "not started".
        result = attach_neighbour_mastery(self.neighbourhood(), {})

        self.assertIsNone(result.neighbours[1].mastery)

    def test_the_centre_concept_and_counts_survive_the_join(self):
        result = attach_neighbour_mastery(self.neighbourhood(), {})

        self.assertEqual(result.concept.id, "Reactivity")
        self.assertEqual(result.linked_count, 25)


if __name__ == "__main__":
    unittest.main()
