"""The Render start script turns Render's settings into the names CORA reads.

Run from the repo root (standard library only, no services needed):
    python3 -m unittest deploy/render/test_start_backend.py

The trap these tests pin: backend/src/llm.py looks a model up by upper-casing
its key and turning "." into "_", and nothing else. So a key like
"openai_gpt-4.1-mini" looks for an env name with a "-" in it, which can never
match. Every model key the script hands out must resolve to a config it set.
"""

import importlib.util
import os
import unittest
from pathlib import Path
from unittest.mock import patch

_spec = importlib.util.spec_from_file_location("start_backend", Path(__file__).with_name("start_backend.py"))
start_backend = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(start_backend)

FAKE_KEY = "sk-test-not-a-real-key"
MODEL_KEY_SETTINGS = ("LEARNING_MODEL", "LEARNER_CHAT_MODEL", "INGESTION_MODEL", "DEFAULT_DIFFBOT_CHAT_MODEL",
                      "GRAPH_CLEANUP_MODEL")


def lookup_name(model_key: str) -> str:
    """Exactly how backend/src/llm.py get_llm() builds the env name."""
    return f"LLM_MODEL_CONFIG_{model_key.upper().replace('.', '_').strip()}"


class ConfigureOpenAITests(unittest.TestCase):
    def run_with(self, **env):
        with patch.dict(os.environ, {"OPENAI_API_KEY": FAKE_KEY, **env}, clear=True):
            start_backend.configure_openai()
            return dict(os.environ)

    def test_every_model_setting_resolves_to_a_config_the_backend_can_find(self):
        env = self.run_with(OPENAI_MODEL="gpt-4.1-mini")

        for setting in MODEL_KEY_SETTINGS:
            with self.subTest(setting=setting):
                self.assertIn(lookup_name(env[setting]), env)

    def test_config_line_is_model_then_key(self):
        env = self.run_with(OPENAI_MODEL="gpt-4.1-mini")

        self.assertEqual(env[lookup_name(env["LEARNING_MODEL"])], f"gpt-4.1-mini,{FAKE_KEY}")

    def test_the_admin_model_picker_name_resolves_too(self):
        # render.yaml offers "openai_gpt_4.1_mini" in the admin model picker.
        env = self.run_with(OPENAI_MODEL="gpt-4.1-mini")

        self.assertIn(lookup_name("openai_gpt_4.1_mini"), env)

    def test_guests_default_to_the_paid_model_only_when_asked(self):
        paid = self.run_with(OPENAI_MODEL="gpt-4.1-mini", GUEST_USES_OPENAI="true")
        off = self.run_with(OPENAI_MODEL="gpt-4.1-mini")

        self.assertEqual(paid["GUEST_LLM_MODEL"], paid["LEARNING_MODEL"])
        self.assertNotIn("GUEST_LLM_MODEL", off)  # unset = guest AI off (fails closed)

    def test_an_explicit_guest_model_wins(self):
        env = self.run_with(OPENAI_MODEL="gpt-4.1-mini", GUEST_USES_OPENAI="true", GUEST_LLM_MODEL="guest_free")

        self.assertEqual(env["GUEST_LLM_MODEL"], "guest_free")

    def test_missing_key_stops_startup(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError):
                start_backend.configure_openai()


class NoAuth0Tests(unittest.TestCase):
    def test_auth0_shim_is_gone(self):
        self.assertFalse(hasattr(start_backend, "configure_temporary_auth0"))


if __name__ == "__main__":
    unittest.main()
