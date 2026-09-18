import unittest
from unittest.mock import patch

from src.make_relationships import create_chunk_embeddings, create_chunk_vector_index


class EmbeddingToggleTests(unittest.TestCase):
    def test_disabled_embeddings_do_not_load_or_call_embedding_provider(self):
        with (
            patch("src.make_relationships.get_value_from_env", return_value=False),
            patch("src.make_relationships.load_embedding_model") as load_model,
        ):
            create_chunk_embeddings(graph=None, chunkId_chunkDoc_list=[], file_name="course.pdf")

        load_model.assert_not_called()

    def test_disabled_embeddings_do_not_create_vector_index(self):
        with (
            patch("src.make_relationships.get_value_from_env", return_value=False),
            patch("src.make_relationships.load_embedding_model") as load_model,
            patch("src.make_relationships.execute_graph_query") as execute_query,
        ):
            create_chunk_vector_index(graph=None)

        load_model.assert_not_called()
        execute_query.assert_not_called()


if __name__ == "__main__":
    unittest.main()
