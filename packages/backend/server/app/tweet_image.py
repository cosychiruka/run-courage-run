"""
tweet_image.py — Render a news article as a styled card PNG for Twitter.

Uses Playwright (headless Chromium) to screenshot an inline HTML page
that mirrors the site's newspaper card aesthetic.
Runs async and caches renders in Redis to avoid re-rendering the same article.
"""

import hashlib
import base64
import asyncio
import redis.asyncio as aioredis
from typing import Optional

from app.config import REDIS_URL
from app.news_cache import fetch_full_article

CARD_TTL = 3600  # 1 hour — reuse rendered card for the same URL

# ── Redis ──────────────────────────────────────────────────────────────────────
_redis: Optional[aioredis.Redis] = None

async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(REDIS_URL, decode_responses=False)  # bytes for image data
    return _redis


# ── HTML card template — mirrors Newspaper.css aesthetic ──────────────────────

def _build_card_html(article: dict) -> str:
    title       = (article.get("title") or "")[:120]
    description = (article.get("description") or "")[:200]
    source      = (article.get("source_name") or article.get("source", {}).get("name", "") or "News")
    image_url   = article.get("image_url") or article.get("image") or ""

    img_tag = f'<img class="card-image" src="{image_url}" />' if image_url else ""

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    width: 600px; height: 314px;
    background: #a7a7a7;
    font-family: 'Georgia', serif;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }}
  .banner {{
    background: #1a1a1a;
    color: #ca0302;
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 2px;
    padding: 6px 16px;
    display: flex;
    justify-content: space-between;
  }}
  .paper {{
    flex: 1;
    background: #d8d2c4;
    margin: 8px;
    border-radius: 2px;
    padding: 12px 14px;
    display: grid;
    grid-template-columns: 1fr {('200px' if image_url else '0')};
    gap: 12px;
    overflow: hidden;
    box-shadow: 2px 2px 8px rgba(0,0,0,0.3);
  }}
  .text-col {{
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: hidden;
  }}
  .source {{
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #ca0302;
    font-weight: bold;
    border-bottom: 2px solid #040404;
    padding-bottom: 4px;
    margin-bottom: 2px;
  }}
  .title {{
    font-size: 18px;
    font-weight: bold;
    color: #111;
    line-height: 1.25;
    text-transform: uppercase;
  }}
  .desc {{
    font-size: 11px;
    color: #333;
    line-height: 1.4;
  }}
  .card-image {{
    width: 200px;
    height: 100%;
    object-fit: cover;
    border-radius: 2px;
  }}
  .footer {{
    background: #111;
    color: #ca0302;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
    padding: 5px 16px;
    text-align: center;
  }}
</style>
</head>
<body>
  <div class="banner">
    <span>Run Courage Run — $RCR</span>
    <span>runcouragerun.xyz</span>
  </div>
  <div class="paper">
    <div class="text-col">
      <div class="source">{source}</div>
      <div class="title">{title}</div>
      <div class="desc">{description}</div>
    </div>
    {img_tag}
  </div>
  <div class="footer">The things I do for you people... — Courage</div>
</body>
</html>"""


# ── Playwright screenshot ──────────────────────────────────────────────────────

async def render_news_card(article: dict) -> Optional[bytes]:
    """
    Render a news article as a 600×314 PNG.
    Checks Redis cache first (keyed by URL hash).
    Returns PNG bytes or None on failure.
    """
    url = article.get("url") or article.get("image_url") or str(article.get("title", ""))
    cache_key = "card:" + hashlib.md5(url.encode()).hexdigest()

    # Check cache
    r = await _get_redis()
    cached = await r.get(cache_key)
    if cached:
        return cached

    # Render
    try:
        from playwright.async_api import async_playwright
        html = _build_card_html(article)

        async with async_playwright() as p:
            browser = await p.chromium.launch(args=["--no-sandbox"])
            page    = await browser.new_page(viewport={"width": 600, "height": 314})
            await page.set_content(html, wait_until="networkidle")
            png = await page.screenshot(type="png")
            await browser.close()

        await r.set(cache_key, png, ex=CARD_TTL)
        return png

    except Exception as e:
        print(f"[TWEET IMAGE] Render failed: {e}")
        return None


async def render_card_for_url(article_url: str) -> Optional[bytes]:
    """Fetch article metadata from cache/DB then render."""
    from app.news_cache import get_all_recent
    articles = await get_all_recent(limit=50)
    article  = next((a for a in articles if a.get("url") == article_url), None)
    if not article:
        article = {"url": article_url, "title": article_url}
    return await render_news_card(article)
