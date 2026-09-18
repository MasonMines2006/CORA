import unittest

from src.learning.graph import get_source_passages


class FakeGraph:
    def __init__(self, rows):
        self.rows = rows
        self.last_params = None

    def query(self, _query, params=None):
        self.last_params = params or {}
        return self.rows


class LearningSourceTests(unittest.TestCase):
    def test_source_passages_are_clean_bounded_and_keep_document_context(self):
        graph = FakeGraph(
            [
                {"text": "  Control rods absorb neutrons.  ", "source": "PULSTAR Manual.pdf"},
                {"text": "", "source": "Empty.pdf"},
                {"text": "Reactivity changes the neutron population.", "source": "Theory.pdf"},
            ]
        )

        passages = get_source_passages(graph, "reactivity", limit=2)

        self.assertEqual(len(passages), 2)
        self.assertEqual(passages[0]["text"], "Control rods absorb neutrons.")
        self.assertEqual(passages[0]["source"], "PULSTAR Manual.pdf")
        self.assertEqual(graph.last_params["concept_id"], "reactivity")
        self.assertEqual(graph.last_params["limit"], 2)

    def test_source_passages_can_be_empty_without_error(self):
        self.assertEqual(get_source_passages(FakeGraph([]), "missing"), [])


if __name__ == "__main__":
    unittest.main()
