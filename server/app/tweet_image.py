"""
tweet_image.py — Render a news article as The Courageous Chronicle card PNG for Twitter.

900×900 square canvas. Left 50% = article image (cover crop). Right 50% = masthead + headline.
Final output: rotated −30° on RGBA transparent background for the comic-newspaper spin effect.
"""

import hashlib
import io
import asyncio
import datetime
import math
import redis.asyncio as aioredis
import httpx
from typing import Optional
from PIL import Image, ImageDraw, ImageFont

from app.config import REDIS_URL

CARD_TTL = 3600  # 1 hour Redis cache

CARD_W   = 900
CARD_H   = 900
LEFT_W   = 450
RIGHT_W  = 450
BANNER_H = 45
FOOTER_H = 55

BG_PAPER  = (240, 234, 220)
BG_DARK   = (26, 26, 26)
PINK      = (235, 87, 193)
TEXT_DARK = (17, 17, 17)
TEXT_MED  = (60, 55, 60)
DIVIDER   = (4, 4, 4)


# ── Font helpers ───────────────────────────────────────────────────────────────

def _get_font(size: int) -> ImageFont.FreeTypeFont:
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def _get_font_regular(size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", size)
    except Exception:
        return ImageFont.load_default()


def _wrap_text(text: str, font, max_width: int, draw: ImageDraw.Draw) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for word in words:
        test = f"{cur} {word}".strip()
        if draw.textbbox((0, 0), test, font=font)[2] <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines or [""]


# ── Time-adaptive edition ──────────────────────────────────────────────────────

def _get_edition_info() -> tuple[str, str]:
    """Return (label, time_of_day) based on current server hour."""
    h = datetime.datetime.now().hour
    if 5 <= h < 11:
        return "Morning Final", "sunrise"
    if 11 <= h < 17:
        return "Afternoon Final", "sun"
    if 17 <= h < 21:
        return "Evening Final", "sunset"
    return "Late Final", "moon"


def _draw_time_icon(draw: ImageDraw.Draw, cx: int, cy: int, tod: str, size: int = 22) -> None:
    r = size // 2
    if tod == "sun":
        draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=PINK)
        for deg in range(0, 360, 45):
            a = math.radians(deg)
            draw.line(
                [(cx + int((r + 3) * math.cos(a)), cy + int((r + 3) * math.sin(a))),
                 (cx + int((r + 10) * math.cos(a)), cy + int((r + 10) * math.sin(a)))],
                fill=PINK, width=2,
            )
    elif tod in ("sunrise", "sunset"):
        # Semicircle dome-up + horizon line + upward rays
        draw.pieslice([(cx - r, cy - r), (cx + r, cy + r)], start=180, end=360, fill=PINK)
        draw.line([(cx - r - 6, cy), (cx + r + 6, cy)], fill=PINK, width=2)
        for deg in range(225, 316, 30):  # upward fan (270° = up in Y-down coords)
            a = math.radians(deg)
            draw.line(
                [(cx + int((r + 3) * math.cos(a)), cy + int((r + 3) * math.sin(a))),
                 (cx + int((r + 12) * math.cos(a)), cy + int((r + 12) * math.sin(a)))],
                fill=PINK, width=2,
            )
    else:  # moon
        draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=PINK)
        off = max(1, r // 2)
        # Offset circle cuts out crescent, filled with paper color
        draw.ellipse([(cx - r + off, cy - r), (cx + r + off, cy + r)], fill=BG_PAPER)


# ── Card renderer ──────────────────────────────────────────────────────────────

def _render_card_sync(article: dict, thumb: Optional[Image.Image] = None) -> bytes:
    """Draw the Courageous Chronicle card. Returns PNG bytes (already rotated)."""
    title       = (article.get("title") or "")[:120]
    description = (article.get("description") or "")[:300]

    img  = Image.new("RGB", (CARD_W, CARD_H), BG_PAPER)
    draw = ImageDraw.Draw(img)

    font_banner   = _get_font(14)
    font_masthead = _get_font(22)
    font_subtitle = _get_font_regular(12)
    font_source   = _get_font(11)
    font_edition  = _get_font(12)
    font_title    = _get_font(20)
    font_exclaim  = _get_font(34)
    font_desc     = _get_font_regular(13)
    font_footer   = _get_font(11)

    # ── Top banner: dark strip, #News4Pluckies repeating ─────────────────────
    draw.rectangle([(0, 0), (CARD_W, BANNER_H)], fill=BG_DARK)
    draw.text((10, (BANNER_H - 14) // 2), "#News4Pluckies  " * 10, fill=PINK, font=font_banner)

    # ── Left column: article image (cover-fill) ───────────────────────────────
    img_y0 = BANNER_H
    img_h  = CARD_H - BANNER_H - FOOTER_H

    if thumb:
        src_w, src_h = thumb.size
        scale = max(LEFT_W / src_w, img_h / src_h)
        nw, nh = int(src_w * scale), int(src_h * scale)
        resized = thumb.resize((nw, nh), Image.LANCZOS)
        xo = (nw - LEFT_W) // 2
        yo = (nh - img_h) // 2
        img.paste(resized.crop((xo, yo, xo + LEFT_W, yo + img_h)), (0, img_y0))
    else:
        draw.rectangle([(0, img_y0), (LEFT_W, img_y0 + img_h)], fill=(30, 25, 40))
        wm = _get_font(16)
        draw.text((LEFT_W // 2 - 40, img_y0 + img_h // 2 - 10), "NO IMAGE", fill=(80, 60, 100), font=wm)

    # Vertical separator between columns
    draw.line([(LEFT_W, img_y0), (LEFT_W, img_y0 + img_h)], fill=(200, 180, 210), width=2)

    # ── Right column: masthead + text ─────────────────────────────────────────
    rx = LEFT_W + 14          # left edge of text area
    rw = RIGHT_W - 28         # usable text width
    ry = BANNER_H + 14        # current y cursor

    # Masthead title
    for line in _wrap_text("The Courageous Chronicle", font_masthead, rw, draw):
        draw.text((rx, ry), line, fill=TEXT_DARK, font=font_masthead)
        ry += draw.textbbox((0, 0), line, font=font_masthead)[3] + 2

    # Subtitle
    draw.text((rx, ry), "The World's Bravest Newspaper", fill=TEXT_MED, font=font_subtitle)
    ry += 18

    # Thin divider
    draw.line([(rx, ry), (rx + rw, ry)], fill=DIVIDER, width=1)
    ry += 8

    # Source label + edition (right side) + time icon
    edition_label, tod = _get_edition_info()
    draw.text((rx, ry), "NOWHERE NEWS", fill=PINK, font=font_source)

    ed_w = draw.textbbox((0, 0), edition_label, font=font_edition)[2]
    icon_cx = LEFT_W + RIGHT_W - 16
    ed_x    = icon_cx - 28 - ed_w
    draw.text((ed_x, ry), edition_label, fill=TEXT_MED, font=font_edition)
    _draw_time_icon(draw, icon_cx, ry + 8, tod, size=22)
    ry += 24

    # Bold divider under source row
    draw.line([(rx, ry), (rx + rw, ry)], fill=DIVIDER, width=3)
    ry += 10

    # Headline (up to 4 lines)
    for line in _wrap_text(title.upper(), font_title, rw - 4, draw)[:4]:
        draw.text((rx, ry), line, fill=TEXT_DARK, font=font_title)
        ry += 26

    # "!!!" accent in pink
    draw.text((rx, ry), "!!!", fill=PINK, font=font_exclaim)
    ry += 44  # ~34px font + spacing

    # Thin accent divider
    draw.line([(rx, ry), (rx + rw, ry)], fill=(180, 160, 170), width=1)
    ry += 8

    # Description text
    max_y = CARD_H - FOOTER_H - 12
    for line in _wrap_text(description, font_desc, rw - 4, draw)[:12]:
        if ry + 17 > max_y:
            break
        draw.text((rx, ry), line, fill=TEXT_MED, font=font_desc)
        ry += 17

    # ── Footer ────────────────────────────────────────────────────────────────
    footer_y = CARD_H - FOOTER_H
    draw.rectangle([(0, footer_y), (CARD_W, CARD_H)], fill=BG_DARK)
    ftxt = "THE THINGS I DO FOR YOU PEOPLE... — COURAGE"
    fw = draw.textbbox((0, 0), ftxt, font=font_footer)[2]
    draw.text(((CARD_W - fw) // 2, footer_y + (FOOTER_H - 14) // 2), ftxt, fill=PINK, font=font_footer)

    # ── Rotate −30° on transparent RGBA background ───────────────────────────
    rgba    = img.convert("RGBA")
    rotated = rgba.rotate(-30, expand=True, fillcolor=(0, 0, 0, 0))

    buf = io.BytesIO()
    rotated.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ── Fetch thumbnail ────────────────────────────────────────────────────────────

async def _fetch_image(url: str) -> Optional[Image.Image]:
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


# ── Public API ─────────────────────────────────────────────────────────────────

async def render_news_card(article: dict) -> Optional[bytes]:
    """
    Render a news article as a 900×900 PNG (rotated −30° on transparent bg).
    Checks Redis cache first (keyed by URL hash, v2 prefix to bust old 600×314 caches).
    Returns PNG bytes or None on failure.
    """
    url = article.get("url") or article.get("image_url") or str(article.get("title", ""))
    cache_key = "card_v2:" + hashlib.md5(url.encode()).hexdigest()

    r = None
    try:
        r = await _get_redis()
        if r:
            cached = await r.get(cache_key)
            if cached:
                return cached
    except Exception:
        pass

    image_url = article.get("image_url") or article.get("image") or ""
    thumb = await _fetch_image(image_url)

    try:
        png = await asyncio.to_thread(_render_card_sync, article, thumb)
    except Exception as e:
        print(f"[TWEET IMAGE] Render failed: {e}")
        return None

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
