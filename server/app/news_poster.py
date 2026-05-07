"""
news_poster.py — Pixel-perfect newspaper generator for news tweets.
Uses Pillow for perfect alignment, dimensions, and branding.
Matches webapp layout but elevated with Courage purple theme.
"""

from PIL import Image, ImageDraw, ImageFont
import httpx
import time
import os
import io
from app.config import DB_PATH

async def generate_news_poster_image(news: dict) -> Image.Image:
    """Core logic to build the PIL Image object."""
    WIDTH, HEIGHT = 1200, 675
    img = Image.new("RGB", (WIDTH, HEIGHT), color="#F5F0E8")  # classic newspaper beige
    draw = ImageDraw.Draw(img)

    # Helper for multiline text wrapping
    def draw_text_wrapped(draw, text, position, font, max_width, fill="black"):
        lines = []
        words = text.split()
        while words:
            line = ''
            while words and draw.textbbox((0,0), line + words[0], font=font)[2] <= max_width:
                line += words.pop(0) + ' '
            lines.append(line.strip())
        
        x, y = position
        for line in lines:
            draw.text((x, y), line, fill=fill, font=font)
            y += font.size + 8
        return y

    # Fonts (use system or download to public/fonts/)
    try:
        title_font = ImageFont.truetype("arialbd.ttf", 72)
        headline_font = ImageFont.truetype("arialbd.ttf", 52)
        body_font = ImageFont.truetype("arial.ttf", 28)
        small_font = ImageFont.truetype("arial.ttf", 24)
        banner_font = ImageFont.truetype("arialbd.ttf", 42)
    except:
        title_font = ImageFont.load_default()
        headline_font = ImageFont.load_default()
        body_font = ImageFont.load_default()
        small_font = ImageFont.load_default()
        banner_font = ImageFont.load_default()

    # ── TOP BANNER ──
    draw.text((40, 15), "MemeNewsMemeNewsMemeNews", fill="#D32F2F", font=title_font)
    draw.line((30, 90, 1170, 90), fill="black", width=6)

    # EXTRA! left + Title center + Morning Final right
    draw.text((50, 110), "EXTRA! EXTRA!", fill="black", font=banner_font)
    draw.text((380, 105), "The Courageous Chronicle", fill="black", font=title_font)
    draw.text((920, 115), "MORNING FINAL", fill="black", font=banner_font)

    # Subtitle
    draw.text((410, 175), "The World's Bravest Newspaper", fill="#555555", font=small_font)

    # Separator line
    draw.line((40, 210, 1160, 210), fill="#8E24AA", width=8)  # Courage purple

    # ── HEADLINE ──
    draw_text_wrapped(draw, news.get("headline", "").upper(), (50, 230), headline_font, 1100)

    # ── NEWS PHOTO (left side) ──
    if news.get("image_url"):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(news["image_url"], timeout=10)
                photo = Image.open(io.BytesIO(resp.content)).convert("RGB")
                photo = photo.resize((420, 300), Image.Resampling.LANCZOS)
                img.paste(photo, (50, 320))
        except:
            pass

    # ── STORY BOX (right side) ──
    story_text = news.get("story", "")[:380] + "..." if len(news.get("story", "")) > 380 else news.get("story", "")
    draw_text_wrapped(draw, story_text, (510, 330), body_font, 620)

    # ── SOURCE + TIME (under photo) ──
    source_line = f"The {news.get('source', 'Guardian')} • {news.get('time_ago', '7h ago')}"
    draw.text((70, 630), source_line, fill="#666666", font=small_font)

    # ── COURAGE BRANDING BOTTOM BAR ──
    draw.rectangle((0, 640, WIDTH, HEIGHT), fill="#8E24AA")  # signature purple
    draw.text((50, 652), "THE THINGS I DO FOR YOU PEOPLE... — COURAGE", fill="white", font=ImageFont.truetype("arialbd.ttf", 32) if os.name == 'nt' else banner_font)

    return img

async def generate_news_poster(news: dict) -> str:
    """Returns public URL to the finished poster."""
    img = await generate_news_poster_image(news)
    filename = f"courage_news_poster_{int(time.time())}.png"
    os.makedirs("public", exist_ok=True)
    img.save(f"public/{filename}", quality=95, optimize=True)
    return f"https://runcouragerun.life/public/{filename}"

async def generate_news_poster_bytes(news: dict) -> bytes:
    """Returns raw PNG bytes."""
    img = await generate_news_poster_image(news)
    buf = io.BytesIO()
    img.save(buf, format="PNG", quality=95)
    return buf.getvalue()
