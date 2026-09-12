import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.llm import is_retryable_llm_error


class FakeHttpError(Exception):
    def __init__(self, status_code, message):
        super().__init__(message)
        self.status_code = status_code


class LlmFallbackTests(unittest.TestCase):
    def test_unavailable_free_model_can_use_configured_fallback(self):
        error = FakeHttpError(404, "This model is unavailable for free")
        self.assertTrue(is_retryable_llm_error(error))

    def test_unrelated_not_found_is_not_retryable(self):
        error = FakeHttpError(404, "Unknown route")
        self.assertFalse(is_retryable_llm_error(error))


if __name__ == "__main__":
    unittest.main()
