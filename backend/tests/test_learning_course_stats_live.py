"""Course stats against the real graph.

Home used to derive "documents" and "passages" from its top-50 concept sample:
documents undercounted (only sources of those 50 concepts) and passages
overcounted (a passage that mentions three concepts was added three times).
`get_course_stats` counts them directly. A fake graph would never parse the
Cypher (see CLAUDE.md, Backend gotchas), so this runs against Neo4j and checks
the numbers against independent, simpler queries.

Skips cleanly when no Neo4j is configured or nothing is published.
"""

import os
import unittest

from src.learning.graph import get_course_stats, get_learning_graph, list_concepts
from src.shared.published_corpus import published_document

_PUBLISHED_DOCS = "MATCH (d:Document) WHERE " + published_document("d") + " RETURN count(d) AS n"
_PUBLISHED_PASSAGES = (
    "MATCH (c:Chunk)-[:PART_OF]->(d:Document) WHERE " + published_document("d")
    + " RETURN count(DISTINCT c) AS n"
)


class CourseStatsLiveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.environ.get("NEO4J_URI"):
            raise unittest.SkipTest("No Neo4j configured; skipping live course stats check")
        try:
            cls.graph = get_learning_graph()
        except Exception as exc:  # pragma: no cover - environment dependent
            raise unittest.SkipTest(f"Could not open the learning graph: {exc}")
        if cls.graph.query(_PUBLISHED_DOCS)[0]["n"] == 0:
            raise unittest.SkipTest("Nothing is published; nothing to count")
        cls.stats = get_course_stats(cls.graph)

    def test_documents_match_published_documents(self):
        self.assertEqual(self.stats.documents, self.graph.query(_PUBLISHED_DOCS)[0]["n"])

    def test_passages_are_distinct_published_chunks(self):
        self.assertEqual(self.stats.passages, self.graph.query(_PUBLISHED_PASSAGES)[0]["n"])

    def test_concept_count_covers_every_listed_concept(self):
        # The list is a ranked, truncated view of the same population.
        listed = list_concepts(self.graph, limit=50)
        self.assertGreaterEqual(self.stats.concepts, len(listed))


if __name__ == "__main__":
    unittest.main()
