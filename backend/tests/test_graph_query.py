import unittest
from unittest.mock import patch

from src.entities.user_credential import Neo4jCredentials
from src.graph_query import execute_query, get_graph_results


class GraphQueryTests(unittest.TestCase):
    def test_empty_document_filter_is_still_sent_to_neo4j(self):
        driver = unittest.mock.Mock()
        driver.execute_query.return_value = ([], None, [])

        execute_query(driver, "MATCH (d:Document) WHERE d.fileName IN $document_names RETURN d", [])

        driver.execute_query.assert_called_once_with(
            "MATCH (d:Document) WHERE d.fileName IN $document_names RETURN d",
            document_names=[],
        )

    def test_missing_document_filter_queries_all_documents(self):
        credentials = Neo4jCredentials(
            uri="bolt://neo4j:7687",
            userName="neo4j",
            password="password",
            database="neo4j",
        )
        driver = unittest.mock.Mock()

        with (
            patch("src.graph_query.get_graphDB_driver", return_value=driver),
            patch("src.graph_query.execute_query", return_value=([], None, [])) as query,
        ):
            result = get_graph_results(credentials, None)

        self.assertEqual(result, {"nodes": [], "relationships": []})
        self.assertEqual(query.call_args.args[2], [])

    def test_connection_failure_is_not_masked_by_closing_none(self):
        credentials = Neo4jCredentials(
            uri="bolt://unavailable:7687",
            userName="neo4j",
            password="password",
            database="neo4j",
        )

        with patch("src.graph_query.get_graphDB_driver", return_value=None):
            with self.assertRaises(Exception) as raised:
                get_graph_results(credentials, "[]")

        self.assertNotIn("NoneType' object has no attribute 'close", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
