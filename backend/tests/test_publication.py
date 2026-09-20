"""Admin publication API and fail-closed visibility rules."""

import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.auth import get_current_user
from src.publication import publication_fingerprint, router


class PublicationApiTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.app = app
        self.client = TestClient(app)

    def role(self, role):
        self.app.dependency_overrides[get_current_user] = lambda: {
            'auth0_sub': 'user-1', 'role': role,
        }

    def test_student_cannot_list_preview_or_publish(self):
        self.role('student')
        self.assertEqual(self.client.get('/admin/materials').status_code, 403)
        self.assertEqual(self.client.get('/admin/materials/Notes.pdf').status_code, 403)
        self.assertEqual(self.client.post('/admin/materials/publish', json={'file_name': 'Notes.pdf'}).status_code, 403)

    def test_admin_can_list_drafts_without_exposing_them_to_students(self):
        self.role('admin')
        draft = {'file_name': 'Notes.pdf', 'processing_status': 'Completed', 'publication_status': 'draft', 'passage_count': 3}
        with patch('src.publication._query', return_value=[draft]) as query:
            response = self.client.get('/admin/materials')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]['publication_status'], 'draft')
        self.assertIn("coalesce(document.publicationStatus, 'draft')", query.call_args.args[0])

    def test_publish_requires_readable_completed_material(self):
        self.role('admin')
        with patch('src.publication._query', return_value=[]) as query:
            response = self.client.post('/admin/materials/publish', json={'file_name': 'Empty.pdf'})
        self.assertEqual(response.status_code, 409)
        self.assertIn("document.status = 'Completed'", query.call_args.args[0])
        self.assertEqual(query.call_args.args[1]['actor'], 'user-1')

    def test_publish_and_unpublish_are_explicit_actions(self):
        self.role('admin')
        with patch('src.publication._query', side_effect=[[{'file_name': 'Notes.pdf', 'passage_count': 3}], [{'file_name': 'Notes.pdf'}]]):
            published = self.client.post('/admin/materials/publish', json={'file_name': 'Notes.pdf'})
            unpublished = self.client.post('/admin/materials/unpublish', json={'file_name': 'Notes.pdf'})
        self.assertEqual(published.status_code, 200)
        self.assertEqual(unpublished.status_code, 200)

    def test_chat_history_fingerprint_changes_when_published_corpus_changes(self):
        class Graph:
            def __init__(self):
                self.rows = [{'file_name': 'One.pdf', 'published_at': '2026-09-20T10:00:00Z'}]

            def query(self, _query):
                return self.rows

        graph = Graph()
        before = publication_fingerprint(graph)
        graph.rows.append({'file_name': 'Two.pdf', 'published_at': '2026-09-20T10:01:00Z'})
        self.assertNotEqual(before, publication_fingerprint(graph))


if __name__ == '__main__':
    unittest.main()
