"""One publication boundary for every student-facing read path.

Product requirement 4 (2026-09-20): Chat, concepts, graph, sources, lessons,
quizzes, review cards and recommendations must all read only from published
documents, enforced on the server.

These tests run without a database. They check the *text* of every query a
student or guest can reach: each `Document` the query binds must carry the
shared `published_document()` predicate. That is a structural rule, so a new
query that forgets the filter fails here even though its fake-graph unit test
would pass. Whether the Cypher actually parses is checked separately, against a
live Neo4j, by tests/test_learning_cypher_syntax.py.
"""

import re
import unittest

from src import publication
from src.learning import graph as learning_graph
from src.shared import constants
from src.shared.published_corpus import published_document

# `(document:Document)`, `(d:Document {fileName: $x})`, `(published:Document)` ...
_DOCUMENT_BINDING = re.compile(r"\((\w+):Document\b")
# Any `:Chunk` read means passage text could reach the response.
_CHUNK_BINDING = re.compile(r":Chunk\b")


def student_queries() -> dict[str, str]:
    """Every query a student or guest request can run against course content."""
    queries = {
        f"learning.graph.{name}": value
        for name, value in vars(learning_graph).items()
        if name.endswith("_QUERY") and isinstance(value, str)
    }
    # Chat: learners are pinned to one mode, so its retrieval query is the one
    # that answers them.
    queries["chat.learner_retrieval_query"] = constants.CHAT_MODE_CONFIG_MAP[
        publication.LEARNER_CHAT_MODE
    ]["retrieval_query"]
    queries["publication._PUBLISHED_FINGERPRINT_QUERY"] = publication._PUBLISHED_FINGERPRINT_QUERY
    return queries


class PublishedPredicateTests(unittest.TestCase):
    def test_predicate_requires_completed_and_published(self):
        self.assertEqual(
            published_document("d"),
            "d.status = 'Completed' AND d.publicationStatus = 'published'",
        )

    def test_predicate_refuses_anything_but_a_variable_name(self):
        for bad in ("", "d.x", "d OR true", "d) MATCH (x", "1d", None):
            with self.subTest(variable=bad):
                with self.assertRaises(ValueError):
                    published_document(bad)


class StudentQueryBoundaryTests(unittest.TestCase):
    def test_learning_queries_are_discovered(self):
        # The structural checks below are only as good as this list.
        names = student_queries()
        for expected in (
            "learning.graph._LIST_CONCEPTS_QUERY",
            "learning.graph._CONCEPT_ROWS_QUERY",
            "learning.graph._SOURCE_CONTEXT_QUERY",
            "learning.graph._SOURCE_PASSAGES_QUERY",
            "learning.graph._CONCEPT_NETWORK_QUERY",
            "learning.graph._CONCEPT_NEIGHBOURHOOD_QUERY",
            "learning.graph._SUGGESTED_CONCEPTS_QUERY",
            "chat.learner_retrieval_query",
        ):
            with self.subTest(query=expected):
                self.assertIn(expected, names)

    def test_every_bound_document_is_constrained_to_published(self):
        for name, query in student_queries().items():
            variables = set(_DOCUMENT_BINDING.findall(query))
            with self.subTest(query=name):
                self.assertTrue(variables, "query never binds a Document, so nothing filters it")
            for variable in variables:
                with self.subTest(query=name, document=variable):
                    self.assertIn(published_document(variable), query)

    def test_queries_that_read_passages_also_bind_a_document(self):
        # A chunk read without its Document has nothing to filter on.
        for name, query in student_queries().items():
            if _CHUNK_BINDING.search(query):
                with self.subTest(query=name):
                    self.assertRegex(query, _DOCUMENT_BINDING)

    def test_no_query_keeps_the_old_answer_key_heuristic(self):
        # Filename guessing ("key" in the name) was replaced by explicit
        # publication. Reintroducing it would hide published material.
        for name, query in student_queries().items():
            with self.subTest(query=name):
                self.assertNotIn("CONTAINS 'key'", query)


class LearnerChatScopeTests(unittest.TestCase):
    def test_learner_chat_mode_uses_the_published_vector_query(self):
        settings = constants.CHAT_MODE_CONFIG_MAP[publication.LEARNER_CHAT_MODE]
        self.assertIs(settings["retrieval_query"], constants.VECTOR_SEARCH_QUERY)
        self.assertIn(published_document("d"), settings["retrieval_query"])

    def test_students_tas_and_guests_are_pinned_to_published_retrieval(self):
        for role in ("student", "ta", "guest", None, "something_new"):
            for mode in ("graph", "graph_vector", "entity_vector", "global_vector", "fulltext", "vector"):
                with self.subTest(role=role, mode=mode):
                    scoped_mode, scoped_names = publication.learner_chat_scope(
                        role, mode, '["Draft notes.pdf"]'
                    )
                    self.assertEqual(scoped_mode, publication.LEARNER_CHAT_MODE)
                    # A learner cannot point retrieval at a document by name.
                    self.assertEqual(scoped_names, "[]")

    def test_admins_keep_the_mode_and_documents_they_chose(self):
        for role in publication.PUBLICATION_ADMIN_ROLES:
            with self.subTest(role=role):
                self.assertEqual(
                    publication.learner_chat_scope(role, "graph", '["Draft.pdf"]'),
                    ("graph", '["Draft.pdf"]'),
                )

    def test_only_admin_roles_can_read_unpublished(self):
        self.assertTrue(publication.can_read_unpublished("admin"))
        for role in ("student", "ta", "guest", "", None, "Admin"):
            with self.subTest(role=role):
                self.assertFalse(publication.can_read_unpublished(role))

    def test_session_is_keyed_to_the_published_revision(self):
        self.assertEqual(publication.published_session_id("abc", "f1"), "abc:pub:f1")

    def test_client_cannot_choose_an_old_revision(self):
        # A learner replaying an old revision's history would get unpublished
        # material back as conversation context.
        self.assertEqual(
            publication.published_session_id("abc:pub:oldrevision", "current"),
            "abc:pub:current",
        )


if __name__ == "__main__":
    unittest.main()
