"""Parse every learning Cypher query against a real Neo4j.

Why this exists: the other learning tests hand `get_concept_network` a fake
graph whose `query()` ignores the Cypher string entirely, so a query can be
syntactically invalid and every unit test still passes. That is exactly what
happened -- `_CONCEPT_NETWORK_QUERY` put `WHERE` before `ORDER BY` inside a
`WITH` clause, which Cypher rejects, and the Graph tab returned 503 while the
suite stayed green.

`EXPLAIN` asks the server to parse and plan a query without running it, so this
is fast and reads nothing from the graph. It needs a live database, so it skips
cleanly when one is not configured (CI without Neo4j); inside the dev container
the connection settings are present and it runs.
"""

import os
import re
import unittest

from src.learning import graph as learning_graph

# Every module-level constant holding a query. Named this way by convention, so
# a new query is covered automatically the moment it is added.
QUERY_CONSTANTS = {
    name: value
    for name, value in vars(learning_graph).items()
    if name.endswith("_QUERY") and isinstance(value, str)
}

# Cypher refuses to plan a query whose parameters are absent, and EXPLAIN never
# reads them, so any placeholder of the right rough shape is enough.
PARAM_PLACEHOLDERS = {
    "limit": 10,
    "min_connectivity": 1,
    "excluded_labels": ["document"],
}


def _neo4j_session():
    """Open a session from server-side env settings, or return None."""
    uri = os.environ.get("NEO4J_URI")
    username = os.environ.get("NEO4J_USERNAME")
    password = os.environ.get("NEO4J_PASSWORD")
    if not uri or not username or not password:
        return None

    from neo4j import GraphDatabase

    driver = GraphDatabase.driver(uri, auth=(username, password))
    try:
        driver.verify_connectivity()
    except Exception:
        driver.close()
        return None
    return driver


class LearningCypherSyntaxTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.driver = _neo4j_session()
        if cls.driver is None:
            raise unittest.SkipTest("No reachable Neo4j; skipping Cypher syntax checks")

    @classmethod
    def tearDownClass(cls):
        if getattr(cls, "driver", None) is not None:
            cls.driver.close()

    def test_every_learning_query_parses(self):
        self.assertTrue(QUERY_CONSTANTS, "No *_QUERY constants found to check")

        database = os.environ.get("NEO4J_DATABASE") or "neo4j"
        for name, query in sorted(QUERY_CONSTANTS.items()):
            with self.subTest(query=name):
                # Supply a placeholder for every $param the query mentions.
                params = {
                    param: PARAM_PLACEHOLDERS.get(param, "placeholder")
                    for param in set(re.findall(r"\$(\w+)", query))
                }
                with self.driver.session(database=database) as session:
                    # EXPLAIN parses and plans; it never executes or returns rows.
                    session.run(f"EXPLAIN {query}", params).consume()


if __name__ == "__main__":
    unittest.main()
