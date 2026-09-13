import unittest
import asyncio
from unittest.mock import patch

from server.app import robinhood_service
from server.app.robinhood_service import _parse_pairs


def make_pair(
    address,
    *,
    symbol="HOOD",
    price="0.0042",
    liquidity=25_000,
    volume=8_000,
    image_url="https://cdn.dexscreener.com/token-images/example.webp",
):
    return {
        "chainId": "robinhood",
        "dexId": "example-dex",
        "pairAddress": f"pair-{address}",
        "url": f"https://dexscreener.com/robinhood/{address}",
        "baseToken": {
            "address": address,
            "symbol": symbol,
            "name": f"{symbol} token",
        },
        "priceUsd": price,
        "priceChange": {"h24": 12.5},
        "volume": {"h24": volume},
        "liquidity": {"usd": liquidity},
        "marketCap": 500_000,
        "txns": {"h24": {"buys": 80, "sells": 40}},
        "info": {"imageUrl": image_url} if image_url else {},
    }


class RobinhoodSnapshotTests(unittest.TestCase):
    def test_boost_source_is_preserved_and_logo_is_proxied(self):
        address = "0x1111111111111111111111111111111111111111"
        records = _parse_pairs(
            [make_pair(address)],
            {address: {"boosted_top"}},
            {},
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["symbol"], "$HOOD")
        self.assertEqual(records[0]["source_tags"], ["boosted_top"])
        self.assertTrue(records[0]["is_boosted"])
        self.assertTrue(records[0]["world_eligible"])
        self.assertEqual(records[0]["logo_url"], f"/api/token-logo/{address}")

    def test_search_result_is_not_mislabeled_as_trending(self):
        address = "0x2222222222222222222222222222222222222222"
        records = _parse_pairs(
            [make_pair(address)],
            {address: {"search_discovery"}},
            {},
        )

        self.assertFalse(records[0]["is_trending"])
        self.assertFalse(records[0]["is_boosted"])
        self.assertEqual(records[0]["source_tags"], ["search_discovery"])

    def test_low_liquidity_or_missing_logo_cannot_enter_world(self):
        low_liquidity = "0x3333333333333333333333333333333333333333"
        missing_logo = "0x4444444444444444444444444444444444444444"
        records = _parse_pairs(
            [
                make_pair(low_liquidity, liquidity=999),
                make_pair(missing_logo, image_url=None),
            ],
            {
                low_liquidity: {"boosted_latest"},
                missing_logo: {"boosted_latest"},
            },
            {},
        )

        by_address = {item["token_address"]: item for item in records}
        self.assertFalse(by_address[low_liquidity]["world_eligible"])
        self.assertFalse(by_address[missing_logo]["world_eligible"])
        self.assertIsNone(by_address[missing_logo]["logo_url"])

    def test_highest_liquidity_pair_wins_deduplication(self):
        address = "0x5555555555555555555555555555555555555555"
        records = _parse_pairs(
            [
                make_pair(address, liquidity=2_000, volume=50_000),
                make_pair(address, liquidity=20_000, volume=2_000),
            ],
            {address: {"search_discovery"}},
            {},
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["liquidity_usd"], 20_000)
        self.assertEqual(records[0]["rank"], 1)


class RobinhoodSnapshotConcurrencyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_stats = robinhood_service._cache_stats
        self.original_fetch_ts = robinhood_service._last_fetch_ts
        self.original_refresh_task = robinhood_service._refresh_task
        robinhood_service._cache_stats = []
        robinhood_service._last_fetch_ts = 0
        robinhood_service._refresh_task = None

    async def asyncTearDown(self):
        robinhood_service._cache_stats = self.original_stats
        robinhood_service._last_fetch_ts = self.original_fetch_ts
        robinhood_service._refresh_task = self.original_refresh_task

    async def test_concurrent_consumers_share_one_refresh(self):
        calls = 0
        expected = [{"symbol": "$HOOD"}]

        async def fake_refresh():
            nonlocal calls
            calls += 1
            await asyncio.sleep(0)
            return expected

        with patch.object(robinhood_service, "_refresh_robinhood_crypto_stats", fake_refresh):
            results = await asyncio.gather(*[
                robinhood_service.get_robinhood_crypto_stats()
                for _ in range(6)
            ])

        self.assertEqual(calls, 1)
        self.assertTrue(all(result is expected for result in results))


if __name__ == "__main__":
    unittest.main()
