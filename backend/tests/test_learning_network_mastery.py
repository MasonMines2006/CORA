"""The course map colours nodes by learning state, so it needs mastery per node.

The Explore artboard (docs/artboards/source/Explore.dc.html) colours every node by
mastery -- selected, mastered, not started -- and the shipped tab coloured by
extracted entity type instead, which is decoration rather than meaning. See
docs/STUDENT_UI.md section 4: "colour encodes state, never decoration."
"""

import unittest

from src.learning.models import ConceptNetwork, NetworkNode
from src.learning.service import attach_mastery


def network() -> ConceptNetwork:
    return ConceptNetwork(
        nodes=[
            NetworkNode(id="reactivity", name="Reactivity", chunk_count=16, document_count=3),
            NetworkNode(id="keff", name="Keff", chunk_count=8, document_count=2),
            NetworkNode(id="xenon", name="Xenon", chunk_count=4, document_count=1),
        ],
        relationships=[],
    )


class AttachMasteryTests(unittest.TestCase):
    def test_known_concepts_carry_their_progress(self):
        rows = {
            "reactivity": {"attempts": 4, "correct": 2},
            "keff": {"attempts": 5, "correct": 5},
        }

        nodes = {node.id: node for node in attach_mastery(network(), rows).nodes}

        self.assertEqual(nodes["reactivity"].mastery.attempts, 4)
        self.assertEqual(nodes["reactivity"].mastery.score, 50)
        self.assertEqual(nodes["keff"].mastery.score, 100)

    def test_unseen_concepts_report_not_started_rather_than_nothing(self):
        # A node with no row is "not started", which the map draws in slate. It
        # must not be null -- the frontend would have to guess what that meant.
        nodes = {node.id: node for node in attach_mastery(network(), {}).nodes}

        self.assertEqual(nodes["xenon"].mastery.attempts, 0)
        self.assertEqual(nodes["xenon"].mastery.score, 0)

    def test_coverage_fields_survive_the_join(self):
        # Node size comes from chunk_count; losing it would collapse the map to
        # uniform dots.
        nodes = {node.id: node for node in attach_mastery(network(), {}).nodes}

        self.assertEqual(nodes["reactivity"].chunk_count, 16)
        self.assertEqual(nodes["reactivity"].document_count, 3)

    def test_a_guest_with_no_saved_progress_is_a_valid_case(self):
        # Guest mode deliberately persists nothing, so an empty mastery map is
        # the normal path, not an error.
        result = attach_mastery(network(), {})

        self.assertEqual(len(result.nodes), 3)
        self.assertTrue(all(node.mastery is not None for node in result.nodes))


if __name__ == "__main__":
    unittest.main()
