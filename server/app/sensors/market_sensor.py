"""Poll the shared Robinhood Chain snapshot and emit verified short-window moves."""

import asyncio

from app.events import emit_event
from app.robinhood_service import (
    get_robinhood_cache_metadata,
    get_robinhood_crypto_stats,
)


LAST_PRICES: dict[str, float] = {}
SURGE_THRESHOLD = 0.04
POLL_SECONDS = 60


def _select_market_event(
    stats: list[dict], previous_prices: dict[str, float]
) -> tuple[dict | None, dict[str, float]]:
    """Return the strongest eligible short-window move and the next baseline."""
    candidates = []
    next_prices: dict[str, float] = {}

    for token in stats:
        token_id = str(token.get("id") or "")
        current = float(token.get("price") or 0)
        if not token_id or current <= 0 or not token.get("world_eligible"):
            continue

        next_prices[token_id] = current
        previous = previous_prices.get(token_id)
        if not previous:
            continue

        change = (current - previous) / previous
        if abs(change) >= SURGE_THRESHOLD:
            candidates.append((abs(change), change, token))

    if not candidates:
        return None, next_prices

    _, change, token = max(candidates, key=lambda item: item[0])
    return {
        "symbol": token.get("symbol"),
        "price": token.get("price"),
        "change_percent": round(change * 100, 2),
        "volume_24h": token.get("volume_24h"),
        "provider": "DexScreener",
        "chain": "Robinhood Chain",
    }, next_prices


async def market_sensor_loop():
    """Emit at most one strongest move per poll, and only from a live snapshot."""
    global LAST_PRICES

    while True:
        try:
            stats = await get_robinhood_crypto_stats()
            metadata = get_robinhood_cache_metadata()

            if metadata.get("is_live"):
                event, next_prices = _select_market_event(stats, LAST_PRICES)
                if event:
                    await emit_event("MARKET_SURGE", event)
                LAST_PRICES = next_prices
        except Exception as exc:
            print(f"[MARKET_SENSOR] Error: {exc}")

        await asyncio.sleep(POLL_SECONDS)
