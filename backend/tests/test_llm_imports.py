import subprocess
import sys
import unittest


class LlmImportTests(unittest.TestCase):
    def test_import_does_not_eagerly_load_every_model_provider(self):
        """Selecting Claude later should not import PyTorch-backed providers now."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "import sys; import src.llm; raise SystemExit(1 if 'torch' in sys.modules else 0)",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(0, result.returncode, result.stderr)

    def test_learning_service_import_does_not_load_optional_ml_stack(self):
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "import sys; import src.learning.service; raise SystemExit(1 if 'torch' in sys.modules else 0)",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(0, result.returncode, result.stderr)


if __name__ == "__main__":
    unittest.main()
