"""
tweet_image.py — High-fidelity newspaper card generator for The Courageous Chronicle.
Matches the modal layout exactly: Full-width masthead over a 2-column body.
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

# Increase dimensions for high-clear quality
W = 1000
H = 1200
PAD = 40

# Colors
BG_PAPER  = (230, 225, 215)
BG_DARK   = (34, 37, 45)
PINK      = (235, 87, 193)
TEXT_DARK = (4, 4, 4)
TEXT_MED  = (60, 55, 60)
DIVIDER   = (4, 4, 4)

def _get_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    ]
    if not bold: paths = ["/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"] + paths
    for path in paths:
        try: return ImageFont.truetype(path, size)
        except Exception: pass
    return ImageFont.load_default()

def _wrap_text(text: str, font, max_width: int, draw: ImageDraw.Draw) -> list[str]:
    words = text.split()
    lines = []
    cur = ""
    for word in words:
        test = f"{cur} {word}".strip()
        if draw.textbbox((0, 0), test, font=font)[2] <= max_width:
            cur = test
        else:
            if cur: lines.append(cur)
            cur = word
    if cur: lines.append(cur)
    return lines or [""]

def _get_edition_info():
    h = datetime.datetime.now().hour
    if 5 <= h < 11:  return "MORNING", "FINAL", "🌅"
    if 11 <= h < 17: return "AFTERNOON", "FINAL", "☀️"
    if 17 <= h < 21: return "EVENING", "FINAL", "🌆"
    return "LATE", "FINAL", "🌙"

def _render_card_sync(article: dict, thumb: Optional[Image.Image] = None) -> bytes:
    title = (article.get("title") or "")[:110].upper()
    description = (article.get("description") or article.get("content") or "")[:500]

    img = Image.new("RGB", (W, H), BG_PAPER)
    draw = ImageDraw.Draw(img)

    # 1. TOP SECTION: PINK BANNER
    banner_h = 60
    draw.rectangle([(0, 0), (W, banner_h)], fill=BG_DARK)
    font_banner = _get_font(22)
    draw.text((20, 15), "[#News4Pluckies]  " * 10, fill=PINK, font=font_banner)

    # 2. HEADING SECTION (Full Width)
    curr_y = banner_h + 30
    
    # Left: EXTRA! EXTRA!
    font_extra = _get_font(28)
    draw.text((PAD, curr_y), "EXTRA!\nEXTRA!", fill=TEXT_DARK, font=font_extra)

    # Center: The Courageous Chronicle
    font_title_main = _get_font(52)
    title_text = "The Courageous Chronicle"
    tw = draw.textbbox((0, 0), title_text, font=font_title_main)[2]
    draw.text(((W - tw) // 2, curr_y), title_text, fill=TEXT_DARK, font=font_title_main)
    
    # Subtitle under center title
    font_sub = _get_font(20, bold=False)
    sub_text = "The Worlds Bravest Newspaper"
    sw = draw.textbbox((0, 0), sub_text, font=font_sub)[2]
    draw.text(((W - sw) // 2, curr_y + 65), sub_text, fill=TEXT_MED, font=font_sub)

    # Right: Edition
    ed1, ed2, icon = _get_edition_info()
    font_ed = _get_font(24)
    draw.text((W - PAD - 120, curr_y), f"{icon}\n{ed1}\n{ed2}", fill=TEXT_DARK, font=font_ed, align="center")

    curr_y += 130
    # Bold separator
    draw.line([(PAD, curr_y), (W - PAD, curr_y)], fill=DIVIDER, width=5)
    curr_y += 10
    draw.text((PAD, curr_y), "NOWHERE NEWS", fill=PINK, font=_get_font(18))
    curr_y += 30
    draw.line([(PAD, curr_y), (W - PAD, curr_y)], fill=DIVIDER, width=2)
    curr_y += 30

    # 3. MIDDLE SECTION: 2 COLUMNS
    col_w = (W - PAD * 3) // 2
    
    # Left Column: Square Image
    img_size = col_w
    if thumb:
        src_w, src_h = thumb.size
        scale = max(img_size / src_w, img_size / src_h)
        nw, nh = int(src_w * scale), int(src_h * scale)
        resized = thumb.resize((nw, nh), Image.LANCZOS)
        img.paste(resized.crop(((nw - img_size) // 2, (nh - img_size) // 2, (nw + img_size) // 2, (nh + img_size) // 2)), (PAD, curr_y))
        # Image border
        draw.rectangle([(PAD, curr_y), (PAD + img_size, curr_y + img_size)], outline=DIVIDER, width=3)
    else:
        draw.rectangle([(PAD, curr_y), (PAD + img_size, curr_y + img_size)], fill=(40, 40, 50), outline=DIVIDER, width=3)
        draw.text((PAD + 50, curr_y + img_size // 2 - 20), "NOWHERE NEWS", fill=PINK, font=font_banner)

    # Right Column: Story
    rx = PAD + col_w + PAD
    ry = curr_y
    
    # Headline (Uppercase)
    font_head = _get_font(34)
    for line in _wrap_text(title, font_head, col_w, draw)[:4]:
        draw.text((rx, ry), line, fill=TEXT_DARK, font=font_head)
        ry += 42
    
    # !!! Pink
    draw.text((rx, ry), "!!!", fill=PINK, font=_get_font(65))
    ry += 80
    
    # Divider
    draw.line([(rx, ry), (rx + col_w, ry)], fill=TEXT_MED, width=1)
    ry += 20
    
    # Description
    font_desc = _get_font(20, bold=False)
    for line in _wrap_text(description, font_desc, col_w, draw)[:15]:
        if ry > H - 100: break
        draw.text((rx, ry), line, fill=TEXT_MED, font=font_desc)
        ry += 28

    # 4. FOOTER
    footer_h = 70
    draw.rectangle([(0, H - footer_h), (W, H)], fill=BG_DARK)
    font_foot = _get_font(18)
    ftxt = "THE THINGS I DO FOR YOU PEOPLE... — COURAGE"
    fw = draw.textbbox((0, 0), ftxt, font=font_foot)[2]
    draw.text(((W - fw) // 2, H - footer_h + 20), ftxt, fill=PINK, font=font_foot)

    # FINAL OUTPUT: STRAIGHT (NO INCLINATION)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()

async def render_news_card(article: dict) -> Optional[bytes]:
    url = article.get("url") or str(article.get("title", ""))
    cache_key = "card_v4:" + hashlib.md5(url.encode()).hexdigest()
    r = await _get_redis()
    if r:
        try:
            cached = await r.get(cache_key)
            if cached: return cached
        except: pass

    image_url = article.get("image_url") or article.get("image") or ""
    thumb = None
    if image_url:
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                res = await client.get(image_url)
                if res.status_code == 200: thumb = Image.open(io.BytesIO(res.content)).convert("RGB")
        except: pass

    try:
        png = await asyncio.to_thread(_render_card_sync, article, thumb)
    except Exception as e:
        print(f"[TWEET IMAGE] Render failed: {e}")
        return None

    if r:
        try: await r.set(cache_key, png, ex=CARD_TTL)
        except: pass
    return png

async def _get_redis():
    global _redis
    if _redis is None:
        try:
            _redis = aioredis.from_url(REDIS_URL, decode_responses=False)
            await asyncio.wait_for(_redis.ping(), timeout=1.0)
        except: _redis = None
    return _redis

_redis = None

async def render_card_for_url(article_url: str) -> Optional[bytes]:
    from app.news_cache import get_all_recent
    articles = await get_all_recent(limit=50)
    article  = next((a for a in articles if a.get("url") == article_url), None)
    if not article: article = {"url": article_url, "title": "LATEST NEWS FROM THE TRENCHES"}
    return await render_news_card(article)
