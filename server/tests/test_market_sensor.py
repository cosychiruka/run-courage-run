import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.sensors.market_sensor import _select_market_event


def token(token_id, symbol, price, *, eligible=True, volume=10_000):
    return {
        "id": token_id,
        "symbol": symbol,
        "price": price,
        "volume_24h": volume,
        "world_eligible": eligible,
    }


class MarketSensorTests(unittest.TestCase):
    def test_first_snapshot_establishes_baseline_without_event(self):
        event, baseline = _select_market_event(
            [token("one", "$ONE", 1.0)],
            {},
        )

        self.assertIsNone(event)
        self.assertEqual(baseline, {"one": 1.0})

    def test_strongest_eligible_move_becomes_sourced_event(self):
        event, baseline = _select_market_event(
            [
                token("one", "$ONE", 1.05),
                token("two", "$TWO", 1.12),
                token("hidden", "$HIDE", 2.0, eligible=False),
            ],
            {"one": 1.0, "two": 1.0, "hidden": 1.0},
        )

        self.assertEqual(event["symbol"], "$TWO")
        self.assertEqual(event["change_percent"], 12.0)
        self.assertEqual(event["provider"], "DexScreener")
        self.assertEqual(event["chain"], "Robinhood Chain")
        self.assertNotIn("hidden", baseline)

    def test_sub_threshold_move_does_not_emit(self):
        event, _ = _select_market_event(
            [token("one", "$ONE", 1.039)],
            {"one": 1.0},
        )

        self.assertIsNone(event)


if __name__ == "__main__":
    unittest.main()
