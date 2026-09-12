import unittest
from pathlib import Path
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import x_client


class XClientSafetyTests(unittest.TestCase):
    def test_kill_switch_prevents_client_construction(self):
        original = x_client.X_AUTOMATION_ENABLED
        x_client.X_AUTOMATION_ENABLED = False
        try:
            with patch.object(x_client, "XRateLimitedClient") as constructor:
                self.assertIsNone(x_client.make_x_client())
                constructor.assert_not_called()
        finally:
            x_client.X_AUTOMATION_ENABLED = original

    def test_account_mismatch_disables_client(self):
        original_enabled = x_client.X_AUTOMATION_ENABLED
        original_expected = x_client.X_EXPECTED_USERNAME
        x_client.X_AUTOMATION_ENABLED = True
        x_client.X_EXPECTED_USERNAME = "cowardlyhood"

        profile = type("Profile", (), {
            "data": type("User", (), {"username": "wrongaccount"})(),
        })()
        fake_client = type("FakeClient", (), {"get_my_profile": lambda self: profile})()
        try:
            with patch.object(x_client, "XRateLimitedClient", return_value=fake_client):
                self.assertIsNone(x_client.make_x_client())
        finally:
            x_client.X_AUTOMATION_ENABLED = original_enabled
            x_client.X_EXPECTED_USERNAME = original_expected


if __name__ == "__main__":
    unittest.main()
