"""Tests for the concept-list noise filter.

Background: the extractor labels every entity with its guessed TYPE, and the
`/learning/concepts` ranking surfaced whatever was best connected -- so students
saw "Reactor Theory Manual", "North Carolina State University" and "Rsac" next to
Reactivity and Keff. `list_concepts()` now drops entities whose labels are never a
teachable topic. These tests pin the rule itself and the shape of the query it
sends, using a fake graph so no Neo4j instance is needed.
"""

import logging
import os
import unittest
from unittest.mock import patch

from src.learning.graph import (
    _CONCEPT_ROWS_QUERY,
    _DEFAULT_EXCLUDED_ENTITY_LABELS,
    _LIST_CONCEPTS_QUERY,
    _normalize_label,
    excluded_entity_labels,
    get_concept,
    list_concepts,
    min_concept_connectivity,
)


class FakeGraph:
    """Records the Cypher and params it is given and replays canned rows."""

    def __init__(self, rows=None):
        self._rows = rows or []
        self.last_query = None
        self.last_params = None

    def query(self, query, params=None):
        self.last_query = query
        self.last_params = params or {}
        return self._rows


def sample_row(name="Reactivity"):
    return {
        "id": name,
        "name": name,
        "chunk_count": 16,
        "document_count": 7,
        "connectivity": 54,
        "sources": ["Theory Manual.pdf"],
    }


def is_excluded(labels):
    """Mirror of the Cypher predicate, so the rule can be tested label-by-label."""
    excluded = excluded_entity_labels()
    return any(_normalize_label(label) in excluded for label in labels)


class ConceptFilterRuleTests(unittest.TestCase):
    """The denylist must catch the observed noise without touching real concepts."""

    def test_extraction_noise_is_excluded(self):
        # Label sets copied from the live graph.
        noise = {
            "Reactor Theory Manual": ["Document", "Manual"],
            "North Carolina State University": ["Institution", "Organization", "Educational institution"],
            "Rsac": ["Entity", "Organization", "Committee"],
            "Reactor Operations": ["Course", "Section"],
            "Reactor Operator": ["Person", "Position", "Human"],
            "July 28, 2023": ["Date"],
            "License No. R-120": ["License"],
            "Primary Cooling System Schematic": ["Schematic"],
        }
        for name, labels in noise.items():
            with self.subTest(entity=name):
                self.assertTrue(is_excluded(labels), f"{name} should be filtered out")

    def test_real_concepts_survive(self):
        keepers = {
            "Reactivity": ["Concept", "Parameter", "Definition"],
            "Keff": ["Concept", "Measurement", "Parameter", "Variable"],
            "Xenon": ["Concept", "Chemical element", "Element", "Substance"],
            "Subcritical Multiplication": ["Concept"],
            # These share a label with noise-ish structure but are teachable, which
            # is why Figure/Section/Header are deliberately not on the denylist.
            "Neutron Life Cycle": ["Concept", "Figure"],
            "Uranium": ["Element", "Material", "Substance", "Figure"],
            "Safety Limits": ["Concept", "Section"],
            "Cooling Tower Header": ["Component", "Header"],
            # An unseen label must default to "keep" -- the vocabulary is open-ended.
            "Some New Physics": ["Brand New Label"],
        }
        for name, labels in keepers.items():
            with self.subTest(entity=name):
                self.assertFalse(is_excluded(labels), f"{name} must stay in the list")

    def test_label_matching_ignores_case_and_underscores(self):
        self.assertTrue(is_excluded(["data_file"]))
        self.assertTrue(is_excluded(["DOCUMENT"]))
        self.assertTrue(is_excluded([" Educational Institution "]))


class ExcludedLabelConfigTests(unittest.TestCase):
    def test_defaults_are_normalised(self):
        labels = excluded_entity_labels()
        self.assertEqual(len(labels), len(_DEFAULT_EXCLUDED_ENTITY_LABELS))
        self.assertIn("document", labels)
        self.assertIn("educational institution", labels)
        self.assertNotIn("concept", labels)

    def test_env_var_replaces_the_default_list(self):
        with patch.dict(os.environ, {"LEARNING_EXCLUDED_ENTITY_LABELS": "Person, Widget"}):
            self.assertEqual(excluded_entity_labels(), frozenset({"person", "widget"}))

    def test_empty_env_var_disables_the_filter(self):
        with patch.dict(os.environ, {"LEARNING_EXCLUDED_ENTITY_LABELS": ""}):
            self.assertEqual(excluded_entity_labels(), frozenset())

    def test_min_connectivity_defaults_and_overrides(self):
        self.assertEqual(min_concept_connectivity(), 2)
        with patch.dict(os.environ, {"LEARNING_MIN_CONCEPT_CONNECTIVITY": "5"}):
            self.assertEqual(min_concept_connectivity(), 5)

    def test_invalid_min_connectivity_falls_back_instead_of_raising(self):
        with patch.dict(os.environ, {"LEARNING_MIN_CONCEPT_CONNECTIVITY": "not-a-number"}):
            self.assertEqual(min_concept_connectivity(), 2)

    def test_invalid_min_connectivity_warns_once(self):
        with patch.dict(os.environ, {"LEARNING_MIN_CONCEPT_CONNECTIVITY": "not-a-number"}):
            with self.assertLogs(level="WARNING") as captured:
                min_concept_connectivity()
        self.assertTrue(any("LEARNING_MIN_CONCEPT_CONNECTIVITY" in line for line in captured.output))

    def test_unset_min_connectivity_is_not_a_warning(self):
        # Leaving the override unset is the normal case, not a misconfiguration.
        # It used to log "Invalid ...; falling back to 2" on every single request,
        # which buried real warnings in the backend log.
        for value in ("", "   "):
            with self.subTest(value=repr(value)):
                with patch.dict(os.environ, {"LEARNING_MIN_CONCEPT_CONNECTIVITY": value}):
                    with patch.object(logging.getLogger(), "warning") as warn:
                        self.assertEqual(min_concept_connectivity(), 2)
                    warn.assert_not_called()

        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("LEARNING_MIN_CONCEPT_CONNECTIVITY", None)
            with patch.object(logging.getLogger(), "warning") as warn:
                self.assertEqual(min_concept_connectivity(), 2)
            warn.assert_not_called()


class ConceptQueryTests(unittest.TestCase):
    def test_list_concepts_sends_the_filter_params(self):
        graph = FakeGraph([sample_row()])

        concepts = list_concepts(graph, limit=20)

        self.assertIn("excluded_labels", graph.last_query)
        self.assertIn("min_connectivity", graph.last_query)
        self.assertEqual(graph.last_params["limit"], 20)
        self.assertIn("document", graph.last_params["excluded_labels"])
        self.assertEqual(graph.last_params["min_connectivity"], 2)
        self.assertEqual(concepts[0].name, "Reactivity")

    def test_empty_graph_returns_an_empty_list(self):
        self.assertEqual(list_concepts(FakeGraph([]), limit=20), [])
        self.assertIsNone(get_concept(FakeGraph([]), "anything"))

    def test_detail_lookup_uses_the_same_filter(self):
        graph = FakeGraph([sample_row()])

        concept = get_concept(graph, "Reactivity")

        self.assertIn("excluded_labels", graph.last_query)
        self.assertIn("document", graph.last_params["excluded_labels"])
        self.assertEqual(concept.name, "Reactivity")

    def test_both_queries_share_one_filter_clause(self):
        clause = "toLower(replace(label, '_', ' ')) IN $excluded_labels"
        self.assertIn(clause, _LIST_CONCEPTS_QUERY)
        self.assertIn(clause, _CONCEPT_ROWS_QUERY)


if __name__ == "__main__":
    unittest.main()
