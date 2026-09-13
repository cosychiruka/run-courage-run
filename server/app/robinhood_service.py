"""Live Robinhood Chain market discovery for Courage's world and widgets.

The public UI and the 3D world share this process-local snapshot. DexScreener's
boost feeds are discovery inputs, not proof that every returned token is
organically trending, so every record retains its source tags and an explicit
world-eligibility flag.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import math
import time
from typing import Any, Dict, Iterable, List

import httpx


_cache_stats: List[Dict[str, Any]] = []
_last_fetch_ts: float = 0
_refresh_task: asyncio.Task | None = None
_last_metadata: Dict[str, Any] = {
    "status": "empty",
    "is_live": False,
    "fetched_at": None,
    "age_seconds": None,
    "provider": "DexScreener",
    "chain": "Robinhood Chain",
}

_CACHE_TTL_SECONDS = 60
_MAX_BATCH_ADDRESSES = 30
_WORLD_MIN_LIQUIDITY_USD = 1_000


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _safe_float(value: Any) -> float:
    try:
        result = float(value or 0)
        return result if math.isfinite(result) else 0.0
    except (TypeError, ValueError):
        return 0.0


def _normalise_symbol(value: Any) -> str:
    return str(value or "").strip().upper()[:18]


def _trend_score(pair: Dict[str, Any], source_tags: Iterable[str]) -> float:
    """Rank discovery candidates without presenting the score as advice."""
    volume = _safe_float(pair.get("volume", {}).get("h24"))
    liquidity = _safe_float(pair.get("liquidity", {}).get("usd"))
    change = abs(_safe_float(pair.get("priceChange", {}).get("h24")))
    txns = pair.get("txns", {}).get("h24", {}) or {}
    activity = _safe_float(txns.get("buys")) + _safe_float(txns.get("sells"))
    boosts = _safe_float(pair.get("boosts", {}).get("active"))
    tags = set(source_tags)

    return round(
        math.log10(volume + 1) * 12
        + math.log10(liquidity + 1) * 8
        + min(change, 300) / 15
        + min(activity, 4_000) / 200
        + min(boosts, 500) / 10
        + (12 if "boosted_top" in tags else 0)
        + (6 if "boosted_latest" in tags else 0),
        2,
    )


def _parse_pairs(
    pairs: Iterable[Dict[str, Any]],
    source_by_address: Dict[str, set[str]],
    discovery_images: Dict[str, str],
) -> List[Dict[str, Any]]:
    """Normalise, deduplicate, rank, and flag DexScreener pair payloads."""
    best_by_token: Dict[str, Dict[str, Any]] = {}

    for pair in pairs:
        if pair.get("chainId") != "robinhood":
            continue

        base_token = pair.get("baseToken") or {}
        token_address = str(base_token.get("address") or "").strip()
        symbol = _normalise_symbol(base_token.get("symbol"))
        if not token_address or not symbol:
            continue

        address_key = token_address.lower()
        tags = sorted(source_by_address.get(address_key, {"search_discovery"}))
        price_usd = _safe_float(pair.get("priceUsd"))
        change_24h = _safe_float(pair.get("priceChange", {}).get("h24"))
        volume_24h = _safe_float(pair.get("volume", {}).get("h24"))
        liquidity_usd = _safe_float(pair.get("liquidity", {}).get("usd"))
        market_cap = _safe_float(pair.get("marketCap") or pair.get("fdv"))
        info = pair.get("info") or {}
        image_url = info.get("imageUrl") or discovery_images.get(address_key) or None
        score = _trend_score(pair, tags)

        record = {
            "id": address_key,
            "token_address": token_address,
            "pair_address": pair.get("pairAddress") or "",
            "dex_id": pair.get("dexId") or "",
            "symbol": f"${symbol}",
            "name": str(base_token.get("name") or symbol).strip()[:80],
            "price": price_usd,
            "change_24h": change_24h,
            "volume_24h": volume_24h,
            "liquidity_usd": liquidity_usd,
            "market_cap": market_cap,
            "image_url": image_url,
            "logo_url": f"/api/token-logo/{token_address}" if image_url else None,
            "platform": "Robinhood Chain",
            "provider": "DexScreener",
            "source_tags": tags,
            "is_boosted": any(tag.startswith("boosted_") for tag in tags),
            "is_trending": any(tag.startswith("boosted_") for tag in tags),
            "trend_score": score,
            "world_eligible": bool(
                image_url
                and price_usd > 0
                and liquidity_usd >= _WORLD_MIN_LIQUIDITY_USD
                and 1 <= len(symbol) <= 18
            ),
            "url": pair.get("url") or f"https://dexscreener.com/robinhood/{token_address}",
        }

        previous = best_by_token.get(address_key)
        if previous is None or record["liquidity_usd"] > previous["liquidity_usd"]:
            best_by_token[address_key] = record

    parsed = sorted(
        best_by_token.values(),
        key=lambda item: (item["trend_score"], item["volume_24h"]),
        reverse=True,
    )
    for rank, item in enumerate(parsed, start=1):
        item["rank"] = rank
    return parsed


def _metadata(status: str, *, is_live: bool) -> Dict[str, Any]:
    age = max(0, int(time.time() - _last_fetch_ts)) if _last_fetch_ts else None
    return {
        "status": status,
        "is_live": is_live,
        "fetched_at": _last_metadata.get("fetched_at"),
        "age_seconds": age,
        "cache_ttl_seconds": _CACHE_TTL_SECONDS,
        "provider": "DexScreener",
        "chain": "Robinhood Chain",
        "method": "boost feeds plus chain-filtered pair discovery",
    }


async def _refresh_robinhood_crypto_stats() -> List[Dict[str, Any]]:
    """Refresh once; callers coalesce through get_robinhood_crypto_stats."""
    global _cache_stats, _last_fetch_ts, _last_metadata
    now = time.time()

    if _cache_stats and (now - _last_fetch_ts) < _CACHE_TTL_SECONDS:
        _last_metadata = _metadata("live-cache", is_live=True)
        return _cache_stats

    try:
        headers = {"User-Agent": "CourageRobinhoodAgent/2.0"}
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            requests = [
                client.get("https://api.dexscreener.com/token-boosts/latest/v1", headers=headers),
                client.get("https://api.dexscreener.com/token-boosts/top/v1", headers=headers),
                client.get("https://api.dexscreener.com/latest/dex/search?q=robinhood", headers=headers),
            ]
            responses = await asyncio.gather(*requests, return_exceptions=True)

            source_by_address: Dict[str, set[str]] = {}
            discovery_images: Dict[str, str] = {}
            search_pairs: List[Dict[str, Any]] = []
            discovery_labels = ("boosted_latest", "boosted_top")

            for index, response in enumerate(responses):
                if not isinstance(response, httpx.Response) or response.status_code != 200:
                    continue
                try:
                    payload = response.json()
                except ValueError:
                    continue

                if index < 2 and isinstance(payload, list):
                    source_label = discovery_labels[index]
                    for item in payload:
                        if item.get("chainId") != "robinhood" or not item.get("tokenAddress"):
                            continue
                        address_key = str(item["tokenAddress"]).lower()
                        source_by_address.setdefault(address_key, set()).add(source_label)
                        if item.get("icon"):
                            discovery_images[address_key] = item["icon"]
                elif index == 2 and isinstance(payload, dict):
                    for pair in payload.get("pairs") or []:
                        if pair.get("chainId") != "robinhood":
                            continue
                        search_pairs.append(pair)
                        address = pair.get("baseToken", {}).get("address")
                        if address:
                            source_by_address.setdefault(str(address).lower(), set()).add("search_discovery")

            addresses = list(source_by_address)[:_MAX_BATCH_ADDRESSES]
            fetched_pairs: List[Dict[str, Any]] = []
            if addresses:
                address_csv = ",".join(addresses)
                details = await client.get(
                    f"https://api.dexscreener.com/tokens/v1/robinhood/{address_csv}",
                    headers=headers,
                )
                if details.status_code == 200:
                    details_payload = details.json()
                    fetched_pairs = details_payload if isinstance(details_payload, list) else []

            parsed = _parse_pairs(
                [*fetched_pairs, *search_pairs],
                source_by_address,
                discovery_images,
            )
            if parsed:
                _cache_stats = parsed
                _last_fetch_ts = now
                _last_metadata = {
                    **_metadata("live", is_live=True),
                    "fetched_at": _utc_now_iso(),
                }
                return _cache_stats

    except Exception as exc:
        print(f"[ROBINHOOD_SERVICE] DexScreener fetch exception: {exc}")

    if _cache_stats:
        _last_metadata = _metadata("stale-cache", is_live=False)
        return _cache_stats

    _last_metadata = _metadata("unavailable", is_live=False)
    return []


async def get_robinhood_crypto_stats() -> List[Dict[str, Any]]:
    """Return one shared snapshot and coalesce concurrent DexScreener refreshes."""
    global _last_metadata, _refresh_task

    if _cache_stats and (time.time() - _last_fetch_ts) < _CACHE_TTL_SECONDS:
        _last_metadata = _metadata("live-cache", is_live=True)
        return _cache_stats

    if _refresh_task is None or _refresh_task.done():
        _refresh_task = asyncio.create_task(_refresh_robinhood_crypto_stats())

    # One cancelled HTTP request must not cancel the refresh for every other
    # widget, world, tool, or sensor waiting on the same shared snapshot.
    return await asyncio.shield(_refresh_task)


def get_robinhood_cache_metadata() -> Dict[str, Any]:
    """Return a copy so API callers cannot mutate the shared state."""
    return {**_last_metadata, "age_seconds": _metadata(
        _last_metadata.get("status", "empty"),
        is_live=bool(_last_metadata.get("is_live")),
    )["age_seconds"]}


async def get_top_robinhood_movers(limit: int = 5) -> Dict[str, List[Dict[str, Any]]]:
    stats = await get_robinhood_crypto_stats()
    sorted_by_change = sorted(stats, key=lambda item: item.get("change_24h", 0), reverse=True)
    gainers = [item for item in sorted_by_change if item.get("change_24h", 0) > 0][:limit]
    dumpers = [item for item in reversed(sorted_by_change) if item.get("change_24h", 0) < 0][:limit]
    return {
        "gainers": gainers,
        "dumpers": dumpers,
        "top_gainer": gainers[0] if gainers else None,
    }


async def get_robinhood_token_info(ticker: str = "DOGGO") -> Dict[str, Any]:
    symbol = _normalise_symbol(ticker).replace("$", "")
    stats = await get_robinhood_crypto_stats()
    matched = next(
        (item for item in stats if item["symbol"].replace("$", "") == symbol),
        None,
    )
    if matched:
        return matched
    return {
        "symbol": f"${symbol}",
        "name": symbol,
        "price": 0.0,
        "change_24h": 0.0,
        "platform": "Robinhood Chain",
        "provider": "DexScreener",
        "status": "unavailable",
    }
