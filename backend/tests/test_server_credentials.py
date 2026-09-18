import asyncio
import os
import unittest
from unittest.mock import patch

from src.entities import user_credential
from src.entities.user_credential import Neo4jCredentials


class ServerCredentialsTests(unittest.TestCase):
    def test_missing_form_values_fall_back_to_server_environment(self):
        with patch.dict(
            os.environ,
            {
                "NEO4J_URI": "bolt://server:7687",
                "NEO4J_USERNAME": "server-user",
                "NEO4J_PASSWORD": "server-password",
                "NEO4J_DATABASE": "neo4j",
            },
        ):
            credentials = asyncio.run(
                user_credential.get_server_neo4j_credentials(Neo4jCredentials())
            )

        self.assertEqual(credentials.uri, "bolt://server:7687")
        self.assertEqual(credentials.userName, "server-user")
        self.assertEqual(credentials.database, "neo4j")

    def test_explicit_form_values_take_precedence(self):
        supplied = Neo4jCredentials(
            uri="bolt://supplied:7687",
            userName="supplied-user",
            password="supplied-password",
            database="course",
        )

        with patch.dict(os.environ, {}, clear=True):
            credentials = asyncio.run(user_credential.get_server_neo4j_credentials(supplied))

        self.assertEqual(credentials, supplied)


if __name__ == "__main__":
    unittest.main()
