"""
tweet_image.py — Render a news article as a styled card PNG for Twitter.

Uses Pillow (PIL) to draw a newspaper-style card — no Chromium needed.
Runs async and caches renders in Redis to avoid re-rendering the same article.
"""

import hashlib
import io
import asyncio
import redis.asyncio as aioredis
import httpx
from typing import Optional
from PIL import Image, ImageDraw, ImageFont

from app.config import REDIS_URL

CARD_TTL = 3600  # 1 hour — reuse rendered card for the same URL

# Card dimensions (Twitter card ratio)
CARD_W, CARD_H = 600, 314
IMG_W = 180  # right-side article image width

# ── Colour palette (newspaper aesthetic) ──────────────────────────────────────
BG_OUTER  = (167, 167, 167)
BG_PAPER  = (216, 210, 196)
BG_DARK   = (26, 26, 26)
RED       = (202, 3, 2)
TEXT_DARK  = (17, 17, 17)
TEXT_MED   = (51, 51, 51)
DIVIDER   = (4, 4, 4)

# ── Font helpers (use default PIL font — always available) ────────────────────

def _get_font(size: int):
    """Get a font at the given size. Uses PIL default (always available)."""
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", size)
    except Exception:
        try:
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", size)
        except Exception:
            return ImageFont.load_default()


def _get_font_regular(size: int):
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", size)
    except Exception:
        return ImageFont.load_default()


def _wrap_text(text: str, font, max_width: int, draw: ImageDraw.Draw) -> list[str]:
    """Word-wrap text to fit within max_width pixels."""
    words = text.split()
    lines = []
    current_line = ""

    for word in words:
        test = f"{current_line} {word}".strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current_line = test
        else:
            if current_line:
                lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return lines or [""]


# ── Fetch article thumbnail ───────────────────────────────────────────────────

async def _fetch_image(url: str) -> Optional[Image.Image]:
    """Download an image URL and return as PIL Image, or None on failure."""
    if not url:
        return None
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            r = await client.get(url)
            if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
                return Image.open(io.BytesIO(r.content)).convert("RGB")
    except Exception:
        pass
    return None


# ── Redis ──────────────────────────────────────────────────────────────────────
_redis: Optional[aioredis.Redis] = None


async def _get_redis() -> Optional[aioredis.Redis]:
    global _redis
    if _redis is None:
        try:
            _redis = aioredis.from_url(REDIS_URL, decode_responses=False)
            await asyncio.wait_for(_redis.ping(), timeout=1.0)
        except Exception:
            _redis = None
    return _redis


# ── Card renderer (PIL) ──────────────────────────────────────────────────────

def _render_card_sync(article: dict, thumb: Optional[Image.Image] = None) -> bytes:
    """Draw the newspaper card using Pillow. Returns PNG bytes."""
    title       = (article.get("title") or "")[:120]
    description = (article.get("description") or "")[:200]
    source      = (article.get("source_name") or article.get("source", {}).get("name", "") or "News").upper()

    img = Image.new("RGB", (CARD_W, CARD_H), BG_OUTER)
    draw = ImageDraw.Draw(img)

    # Fonts
    font_banner  = _get_font(10)
    font_source  = _get_font(9)
    font_title   = _get_font(16)
    font_desc    = _get_font_regular(10)
    font_footer  = _get_font(9)

    # ── Top banner ────────────────────────────────────────────────────────────
    draw.rectangle([(0, 0), (CARD_W, 26)], fill=BG_DARK)
    draw.text((12, 6), "RUN COURAGE RUN — $RCR", fill=RED, font=font_banner)
    # Right-aligned URL
    url_text = "runcouragerun.xyz"
    url_bbox = draw.textbbox((0, 0), url_text, font=font_banner)
    draw.text((CARD_W - (url_bbox[2] - url_bbox[0]) - 12, 6), url_text, fill=RED, font=font_banner)

    # ── Paper body ────────────────────────────────────────────────────────────
    paper_x, paper_y = 8, 34
    has_thumb = thumb is not None
    paper_w = CARD_W - 16
    paper_h = CARD_H - 34 - 28  # minus banner & footer
    draw.rectangle([(paper_x, paper_y), (paper_x + paper_w, paper_y + paper_h)], fill=BG_PAPER)
    # Shadow effect
    draw.rectangle([(paper_x + paper_w, paper_y + 2), (paper_x + paper_w + 2, paper_y + paper_h + 2)], fill=(120, 120, 120))
    draw.rectangle([(paper_x + 2, paper_y + paper_h), (paper_x + paper_w + 2, paper_y + paper_h + 2)], fill=(120, 120, 120))

    text_left = paper_x + 12
    text_top  = paper_y + 10
    text_max_w = paper_w - 24 - (IMG_W + 12 if has_thumb else 0)

    # Source label
    draw.text((text_left, text_top), source, fill=RED, font=font_source)
    text_top += 14
    # Divider line under source
    draw.line([(text_left, text_top), (text_left + text_max_w, text_top)], fill=DIVIDER, width=2)
    text_top += 6

    # Title (wrapped)
    title_lines = _wrap_text(title.upper(), font_title, text_max_w, draw)
    for line in title_lines[:4]:  # max 4 lines
        draw.text((text_left, text_top), line, fill=TEXT_DARK, font=font_title)
        text_top += 20
    text_top += 4

    # Description (wrapped)
    desc_lines = _wrap_text(description, font_desc, text_max_w, draw)
    max_desc_y = paper_y + paper_h - 10
    for line in desc_lines[:6]:
        if text_top + 14 > max_desc_y:
            break
        draw.text((text_left, text_top), line, fill=TEXT_MED, font=font_desc)
        text_top += 14

    # ── Article thumbnail (right side) ────────────────────────────────────────
    if has_thumb:
        thumb_x = paper_x + paper_w - IMG_W - 8
        thumb_h = paper_h - 16
        resized = thumb.resize((IMG_W, thumb_h), Image.LANCZOS)
        img.paste(resized, (thumb_x, paper_y + 8))

    # ── Footer ────────────────────────────────────────────────────────────────
    footer_y = CARD_H - 24
    draw.rectangle([(0, footer_y), (CARD_W, CARD_H)], fill=BG_DARK)
    footer_text = "THE THINGS I DO FOR YOU PEOPLE... — COURAGE"
    fb = draw.textbbox((0, 0), footer_text, font=font_footer)
    ft_w = fb[2] - fb[0]
    draw.text(((CARD_W - ft_w) // 2, footer_y + 5), footer_text, fill=RED, font=font_footer)

    # Export to PNG bytes
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ── Public API ────────────────────────────────────────────────────────────────

async def render_news_card(article: dict) -> Optional[bytes]:
    """
    Render a news article as a 600×314 PNG.
    Checks Redis cache first (keyed by URL hash).
    Returns PNG bytes or None on failure.
    """
    url = article.get("url") or article.get("image_url") or str(article.get("title", ""))
    cache_key = "card:" + hashlib.md5(url.encode()).hexdigest()

    # Check cache (graceful if Redis unavailable)
    r = None
    try:
        r = await _get_redis()
        if r:
            cached = await r.get(cache_key)
            if cached:
                return cached
    except Exception:
        pass

    # Fetch thumbnail (non-blocking, best-effort)
    image_url = article.get("image_url") or article.get("image") or ""
    thumb = await _fetch_image(image_url)

    # Render card in thread to avoid blocking event loop
    try:
        png = await asyncio.to_thread(_render_card_sync, article, thumb)
    except Exception as e:
        print(f"[TWEET IMAGE] Render failed: {e}")
        return None

    # Cache result
    if r:
        try:
            await r.set(cache_key, png, ex=CARD_TTL)
        except Exception:
            pass

    return png


async def render_card_for_url(article_url: str) -> Optional[bytes]:
    """Fetch article metadata from cache/DB then render."""
    from app.news_cache import get_all_recent
    articles = await get_all_recent(limit=50)
    article  = next((a for a in articles if a.get("url") == article_url), None)
    if not article:
        article = {"url": article_url, "title": article_url}
    return await render_news_card(article)
