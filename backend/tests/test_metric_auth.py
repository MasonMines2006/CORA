"""Auth on the paid RAGAS evaluation endpoints: POST /metric and POST /additional_metrics.

Both endpoints call an LLM through RAGAS, so every request costs money. They must be
admin-only, like the rest of the admin evaluation routes in score.py.

No real LLM call happens in these tests. The endpoints import `src.ragas_eval` lazily
(inside the function body), so we put a fake module into `sys.modules` under that name.
Python's import system returns the fake instead of loading the real module, which also
skips the real module's slow import-time work (loading an embedding model, NLTK data).
"""

import sys
import types
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

import score
from src.auth import get_auth_settings, get_current_user

# Form fields the frontend sends (see frontend/src/services/GetRagasMetric.ts).
METRIC_FORM = {
    'question': 'What is a reactor?',
    'context': '["A reactor sustains a chain reaction."]',
    'answer': '["A device that sustains a chain reaction."]',
    'model': 'openai_gpt_4o',
    'mode': '["graph_vector"]',
}
# /additional_metrics takes the same fields plus a reference answer.
ADDITIONAL_FORM = {**METRIC_FORM, 'reference': 'A reactor sustains a controlled chain reaction.'}

# Shapes match what the real functions return, so the endpoint's success path runs.
FAKE_RAGAS_RESULT = {'faithfulness': [1.0], 'answer_relevancy': [0.9], 'context_entity_recall': [0.8]}
FAKE_ADDITIONAL_RESULT = [{'rouge_score': 0.5, 'semantic_score': 0.7}]


class MetricEndpointAuthTests(unittest.TestCase):
    def setUp(self):
        # A fake `src.ragas_eval` whose functions record calls instead of calling an LLM.
        self.fake_ragas = types.ModuleType('src.ragas_eval')
        self.fake_ragas.get_ragas_metrics = MagicMock(return_value=FAKE_RAGAS_RESULT)
        # get_additional_metrics is `async def` in the real module, so the fake must be awaitable.
        self.fake_ragas.get_additional_metrics = AsyncMock(return_value=FAKE_ADDITIONAL_RESULT)
        modules_patch = patch.dict(sys.modules, {'src.ragas_eval': self.fake_ragas})
        modules_patch.start()
        self.addCleanup(modules_patch.stop)

        self.app = score.app
        self.addCleanup(self.app.dependency_overrides.clear)
        self.client = TestClient(self.app)

    def role(self, role):
        """Pretend a user with this role is logged in (skips real Auth0 JWT checks)."""
        self.app.dependency_overrides[get_current_user] = lambda: {
            'auth0_sub': f'{role}-1', 'email': f'{role}@example.com', 'role': role,
        }

    def anonymous(self):
        """No logged-in user. Keep the real get_current_user so the missing
        Authorization header is what rejects the request; only stub the Auth0
        settings so the test does not depend on AUTH0_* values in .env."""
        self.app.dependency_overrides[get_auth_settings] = lambda: object()

    def post_both(self):
        return (
            self.client.post('/metric', data=METRIC_FORM),
            self.client.post('/additional_metrics', data=ADDITIONAL_FORM),
        )

    def assert_no_llm_call(self):
        self.fake_ragas.get_ragas_metrics.assert_not_called()
        self.fake_ragas.get_additional_metrics.assert_not_called()

    def test_anonymous_request_is_rejected(self):
        self.anonymous()
        for response in self.post_both():
            self.assertIn(response.status_code, (401, 403))
        self.assert_no_llm_call()

    def test_student_is_forbidden(self):
        self.role('student')
        for response in self.post_both():
            self.assertEqual(response.status_code, 403)
        self.assert_no_llm_call()

    def test_ta_is_forbidden(self):
        # TAs manage users; running paid evaluations is an admin-only tool like the
        # other admin evaluation routes (ALLOWED_ADMIN_ROLES).
        self.role('ta')
        for response in self.post_both():
            self.assertEqual(response.status_code, 403)
        self.assert_no_llm_call()

    def test_admin_passes_auth_and_reaches_the_evaluation(self):
        self.role('admin')
        metric, additional = self.post_both()

        self.assertEqual(metric.status_code, 200)
        self.assertEqual(metric.json()['status'], 'Success')
        self.assertEqual(metric.json()['data']['graph_vector']['faithfulness'], 1.0)
        self.fake_ragas.get_ragas_metrics.assert_called_once()

        self.assertEqual(additional.status_code, 200)
        self.assertEqual(additional.json()['status'], 'Success')
        self.assertEqual(additional.json()['data']['graph_vector']['rouge_score'], 0.5)
        self.fake_ragas.get_additional_metrics.assert_awaited_once()


if __name__ == '__main__':
    unittest.main()
