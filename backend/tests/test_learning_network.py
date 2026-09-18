import unittest

from src.learning.graph import get_concept_network


class FakeGraph:
    def __init__(self, rows):
        self.rows = rows
        self.last_params = None
        self.last_query = ""

    def query(self, query, params=None):
        self.last_params = params or {}
        self.last_query = query
        return self.rows


class LearningNetworkTests(unittest.TestCase):
    def test_network_returns_deduplicated_nodes_and_edges(self):
        graph = FakeGraph(
            [
                {
                    "nodes": [
                        {"id": "reactivity", "name": "Reactivity", "labels": ["Concept"]},
                        {"id": "keff", "name": "Keff", "labels": ["Parameter"]},
                    ],
                    "relationships": [
                        {"id": "r1", "from_id": "reactivity", "to_id": "keff", "type": "AFFECTS"}
                    ],
                }
            ]
        )

        network = get_concept_network(graph, limit=80)

        self.assertEqual(len(network["nodes"]), 2)
        self.assertEqual(network["nodes"][0]["name"], "Reactivity")
        self.assertEqual(network["relationships"][0]["type"], "AFFECTS")
        self.assertEqual(graph.last_params["limit"], 80)

    def test_empty_network_is_a_valid_result(self):
        self.assertEqual(get_concept_network(FakeGraph([])), {"nodes": [], "relationships": []})

    def test_nodes_carry_the_coverage_the_map_draws_with(self):
        """The Explore artboard sizes nodes by passage count and filters by source
        document, so the network has to return both -- see
        docs/artboards/source/Explore.dc.html."""
        graph = FakeGraph(
            [
                {
                    "nodes": [
                        {
                            "id": "reactivity",
                            "name": "Reactivity",
                            "labels": ["Concept"],
                            "chunk_count": 16,
                            "document_count": 3,
                            "sources": ["Theory Manual - NE235.pdf"],
                        }
                    ],
                    "relationships": [],
                }
            ]
        )

        node = get_concept_network(graph)["nodes"][0]

        self.assertEqual(node["chunk_count"], 16)
        self.assertEqual(node["document_count"], 3)
        self.assertEqual(node["sources"], ["Theory Manual - NE235.pdf"])

    def test_query_projects_coverage_fields(self):
        graph = FakeGraph([])
        get_concept_network(graph)

        for field in ("chunk_count", "document_count", "sources"):
            with self.subTest(field=field):
                self.assertIn(field, graph.last_query)


if __name__ == "__main__":
    unittest.main()
