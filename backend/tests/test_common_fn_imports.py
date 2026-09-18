import subprocess
import sys
import unittest


class CommonFunctionImportTests(unittest.TestCase):
    def test_import_does_not_eagerly_load_torch(self):
        """OpenAI embedding users should not load the optional local ML stack."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys; "
                    "import src.shared.common_fn; "
                    "raise SystemExit(1 if 'torch' in sys.modules else 0)"
                ),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(0, result.returncode, result.stderr)


if __name__ == "__main__":
    unittest.main()
