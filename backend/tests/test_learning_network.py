import unittest

from src.learning.graph import get_concept_network


class FakeGraph:
    def __init__(self, rows):
        self.rows = rows
        self.last_params = None

    def query(self, _query, params=None):
        self.last_params = params or {}
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


if __name__ == "__main__":
    unittest.main()
