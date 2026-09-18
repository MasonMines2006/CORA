"""Check the concept network against a real graph, above the sanitize threshold.

Why this exists: `langchain_neo4j.Neo4jGraph(sanitize=True)` silently **drops any
list in a result that holds more than 128 elements** -- it exists to strip
embedding vectors. `_CONCEPT_NETWORK_QUERY` returns its nodes and relationships
as two lists, so once a course had more than 128 relationships among the
selected concepts, the whole `relationships` list disappeared and the Graph tab
rendered 120 unconnected dots with an HTTP 200 and no error anywhere. Asking for
more than 128 concepts dropped the nodes as well, leaving an empty map.

The unit tests could not catch it: they hand `get_concept_network` a fake graph,
so the sanitize step never runs. This one uses the real client and asks for more
than 128 of each on purpose.

Skips cleanly when no Neo4j is configured or the graph has not been ingested.
"""

import os
import unittest

from src.learning.graph import get_concept_network, get_learning_graph

# The library drops lists longer than this.
SANITIZE_LIST_LIMIT = 128
# Small enough that results stay under the limit even when truncation is broken.
SAFE_LIMIT = 60
# Large enough that both lists must cross the limit to come back intact.
LIMIT_ABOVE_THRESHOLD = 200


class LearningNetworkLiveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.environ.get("NEO4J_URI"):
            raise unittest.SkipTest("No Neo4j configured; skipping live network check")
        try:
            cls.graph = get_learning_graph()
        except Exception as exc:  # pragma: no cover - environment dependent
            raise unittest.SkipTest(f"Could not open the learning graph: {exc}")

        # Size the course from a request small enough to be unaffected by the
        # bug, so a genuinely tiny graph skips but a truncated one still fails.
        cls.baseline = get_concept_network(cls.graph, limit=SAFE_LIMIT)

    def setUp(self):
        if len(self.baseline["nodes"]) < SAFE_LIMIT:
            self.skipTest("Course graph is smaller than the sanitize limit; nothing to prove")
        self.network = get_concept_network(self.graph, limit=LIMIT_ABOVE_THRESHOLD)

    def test_nodes_survive_above_the_sanitize_list_limit(self):
        self.assertGreater(
            len(self.network["nodes"]),
            SANITIZE_LIST_LIMIT,
            "The nodes list was dropped above the 128-element sanitize limit -- "
            "the course map renders empty when this happens",
        )

    def test_relationships_survive_above_the_sanitize_list_limit(self):
        # A wider selection of concepts can only contain more edges, never fewer.
        self.assertGreaterEqual(
            len(self.network["relationships"]),
            len(self.baseline["relationships"]),
            "Widening the selection lost relationships -- they were sanitized away, "
            "leaving the course map as unconnected dots",
        )
        self.assertGreater(len(self.network["relationships"]), SANITIZE_LIST_LIMIT)


if __name__ == "__main__":
    unittest.main()
