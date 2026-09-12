"""
robinhood_service.py — Robinhood & Trending Crypto Intelligence Tracker.
Dynamically fetches real-time trending coins via CoinGecko's free public APIs.
"""

import httpx
import time
import asyncio
from typing import Dict, List, Any

_cache_stats: List[Dict[str, Any]] = []
_last_fetch_ts: float = 0
_CACHE_TTL_SECONDS = 45  # Cache for 45 seconds

async def get_robinhood_crypto_stats() -> List[Dict[str, Any]]:
    """
    Fetches real-time price, 24h % change, volume, and market cap for live trending crypto coins.
    Queries CoinGecko's live /search/trending API dynamically.
    """
    global _cache_stats, _last_fetch_ts
    now = time.time()
    
    if _cache_stats and (now - _last_fetch_ts) < _CACHE_TTL_SECONDS:
        return _cache_stats

    trending_ids: List[str] = []
    
    # 1. Fetch live trending coins from CoinGecko /search/trending
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            tr_resp = await client.get(
                "https://api.coingecko.com/api/v3/search/trending",
                headers={"Accept": "application/json", "User-Agent": "CourageRobinhoodAgent/1.0"}
            )
            if tr_resp.status_code == 200:
                coins = tr_resp.json().get("coins", [])
                for item in coins:
                    coin_id = item.get("item", {}).get("id")
                    if coin_id and coin_id not in trending_ids:
                        trending_ids.append(coin_id)
    except Exception as e:
        print(f"[ROBINHOOD_SERVICE] CoinGecko trending fetch exception: {e}")

    # Use live trending tokens returned by CoinGecko dynamically if available; otherwise use default search list
    if trending_ids:
        target_ids = trending_ids
    else:
        target_ids = ["pepe", "dogecoin", "shiba-inu", "solana", "sui", "dogwifhat", "bonk", "bitcoin", "ethereum"]

    ids_param = ",".join(target_ids)

    # 2. Fetch market stats (price, 24h %, volume, market cap) for the dynamic trending tokens
    url = f"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids={ids_param}&order=market_cap_desc&per_page=30&page=1&sparkline=false&price_change_percentage=24h"

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(url, headers={"Accept": "application/json", "User-Agent": "CourageRobinhoodAgent/1.0"})
            if resp.status_code == 200:
                data = resp.json()
                parsed = []
                for item in data:
                    symbol = item.get("symbol", "").upper()
                    parsed.append({
                        "symbol": f"${symbol}",
                        "name": item.get("name"),
                        "price": float(item.get("current_price") or 0),
                        "change_24h": float(item.get("price_change_percentage_24h") or 0),
                        "high_24h": float(item.get("high_24h") or 0),
                        "low_24h": float(item.get("low_24h") or 0),
                        "volume_24h": float(item.get("total_volume") or 0),
                        "market_cap": float(item.get("market_cap") or 0),
                        "image_url": item.get("image", ""),
                        "platform": "Robinhood & Trending Crypto",
                        "is_trending": True,
                    })
                
                # Sort by change_24h descending (highest gainers first)
                parsed.sort(key=lambda x: x["change_24h"], reverse=True)
                
                _cache_stats = parsed
                _last_fetch_ts = now
                return parsed
    except Exception as e:
        print(f"[ROBINHOOD_SERVICE] CoinGecko market stats fetch failed: {e}")

    # Fallback to cached or offline trending stats if API hits rate limit
    return _cache_stats if _cache_stats else _get_fallback_robinhood_stats()

async def get_top_robinhood_movers(limit: int = 5) -> Dict[str, List[Dict[str, Any]]]:
    """
    Returns top gainers and top dumpers among dynamic trending crypto assets.
    """
    stats = await get_robinhood_crypto_stats()
    if not stats:
        return {"gainers": [], "dumpers": []}

    sorted_by_change = sorted(stats, key=lambda x: x.get("change_24h", 0), reverse=True)
    gainers = [s for s in sorted_by_change if s.get("change_24h", 0) > 0][:limit]
    dumpers = [s for s in reversed(sorted_by_change) if s.get("change_24h", 0) < 0][:limit]

    return {
        "gainers": gainers,
        "dumpers": dumpers,
        "top_gainer": gainers[0] if gainers else None,
    }

async def get_robinhood_token_info(ticker: str = "PEPE") -> Dict[str, Any]:
    """
    Returns specific token details for any ticker dynamically.
    Checks cached stats list first, then queries CoinGecko search API for dynamic lookup.
    """
    symbol = ticker.upper().replace("$", "").strip()
    stats_list = await get_robinhood_crypto_stats()
    matched = next((s for s in stats_list if s["symbol"].replace("$", "").upper() == symbol), None)
    
    if matched:
        return matched

    # Dynamic search fallback for any token
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            search_url = f"https://api.coingecko.com/api/v3/search?query={symbol}"
            s_resp = await client.get(search_url, headers={"User-Agent": "CourageRobinhoodAgent/1.0"})
            if s_resp.status_code == 200:
                coins = s_resp.json().get("coins", [])
                exact_coin = next((c for c in coins if c.get("symbol", "").upper() == symbol), coins[0] if coins else None)
                if exact_coin:
                    coin_id = exact_coin.get("id")
                    details_url = f"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids={coin_id}&price_change_percentage=24h"
                    d_resp = await client.get(details_url, headers={"User-Agent": "CourageRobinhoodAgent/1.0"})
                    if d_resp.status_code == 200 and d_resp.json():
                        item = d_resp.json()[0]
                        return {
                            "symbol": f"${symbol}",
                            "name": item.get("name"),
                            "price": float(item.get("current_price") or 0),
                            "change_24h": float(item.get("price_change_percentage_24h") or 0),
                            "high_24h": float(item.get("high_24h") or 0),
                            "low_24h": float(item.get("low_24h") or 0),
                            "volume_24h": float(item.get("total_volume") or 0),
                            "market_cap": float(item.get("market_cap") or 0),
                            "image_url": item.get("image", ""),
                            "platform": "Robinhood & Trending Crypto",
                        }
    except Exception as e:
        print(f"[ROBINHOOD_SERVICE] Dynamic token search failed for {symbol}: {e}")
    
    return {
        "symbol": f"${symbol}",
        "name": symbol,
        "price": 0.0,
        "change_24h": 0.0,
        "platform": "Robinhood & Trending Crypto",
        "message": f"Tracking {symbol} on Trending Crypto Markets"
    }

def _get_fallback_robinhood_stats() -> List[Dict[str, Any]]:
    """Offline / Fallback list for trending meme and Robinhood assets."""
    return [
        {"symbol": "$PEPE", "name": "Pepe", "price": 0.0000098, "change_24h": 14.2, "platform": "Robinhood & Trending Crypto", "is_trending": True, "image_url": "https://assets.coingecko.com/coins/images/29850/large/pepe-token.png"},
        {"symbol": "$DOGE", "name": "Dogecoin", "price": 0.125, "change_24h": 6.4, "platform": "Robinhood & Trending Crypto", "is_trending": True, "image_url": "https://assets.coingecko.com/coins/images/5/large/dogecoin.png"},
        {"symbol": "$SOL", "name": "Solana", "price": 148.5, "change_24h": 5.8, "platform": "Robinhood & Trending Crypto", "is_trending": True, "image_url": "https://assets.coingecko.com/coins/images/4128/large/solana.png"},
        {"symbol": "$SHIB", "name": "Shiba Inu", "price": 0.0000185, "change_24h": 4.1, "platform": "Robinhood & Trending Crypto", "is_trending": True, "image_url": "https://assets.coingecko.com/coins/images/11939/large/shiba.png"},
        {"symbol": "$SUI", "name": "Sui", "price": 1.05, "change_24h": 11.5, "platform": "Robinhood & Trending Crypto", "is_trending": True, "image_url": "https://assets.coingecko.com/coins/images/26375/large/sui-ocean-square.png"},
        {"symbol": "$WIF", "name": "dogwifhat", "price": 1.62, "change_24h": 9.7, "platform": "Robinhood & Trending Crypto", "is_trending": True, "image_url": "https://assets.coingecko.com/coins/images/33566/large/dogwifhat.jpg"},
        {"symbol": "$BONK", "name": "Bonk", "price": 0.000021, "change_24h": 7.3, "platform": "Robinhood & Trending Crypto", "is_trending": True, "image_url": "https://assets.coingecko.com/coins/images/28600/large/bonk.jpg"},
    ]
