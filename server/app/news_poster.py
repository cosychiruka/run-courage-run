"""
news_poster.py — Pixel-perfect newspaper generator for news tweets.
Uses Pillow for perfect alignment, dimensions, and branding.
Matches webapp layout but elevated with Courage purple theme.
"""

from PIL import Image, ImageDraw, ImageFont, ImageOps
import httpx
import time
import os
import io
from app.config import DB_PATH, COURAGE_BASE_IMAGE_URL

async def generate_news_poster_image(news: dict) -> Image.Image:
    """Core logic to build the PIL Image object."""
    WIDTH, HEIGHT = 1200, 675
    img = Image.new("RGB", (WIDTH, HEIGHT), color="#F5F0E8")  # classic newspaper beige
    draw = ImageDraw.Draw(img)

    # Helper for multiline text wrapping
    def draw_text_wrapped(draw, text, position, font, max_width, fill="black", line_spacing=8):
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
            y += font.size + line_spacing
        return y

    # Fonts
    try:
        title_font = ImageFont.truetype("arialbd.ttf", 72)
        headline_font = ImageFont.truetype("arialbd.ttf", 52)
        body_font = ImageFont.truetype("arial.ttf", 28)
        small_font = ImageFont.truetype("arial.ttf", 24)
        banner_font = ImageFont.truetype("arialbd.ttf", 42)
        signature_font = ImageFont.truetype("arialbd.ttf", 36)
    except:
        title_font = ImageFont.load_default()
        headline_font = ImageFont.load_default()
        body_font = ImageFont.load_default()
        small_font = ImageFont.load_default()
        banner_font = ImageFont.load_default()
        signature_font = ImageFont.load_default()

    # ── TOP BANNER ──
    # Red ticker style
    draw.rectangle((0, 0, WIDTH, 90), fill="#D32F2F")
    draw.text((40, 15), "MemeNews MemeNews MemeNews MemeNews MemeNews", fill="white", font=title_font)
    
    # Newspaper Header
    draw.line((30, 95, 1170, 95), fill="black", width=4)

    # EXTRA! left + Title center + Morning Final right
    draw.text((50, 115), "EXTRA!", fill="black", font=banner_font)
    draw.text((50, 160), "EXTRA!", fill="black", font=banner_font)
    
    # Title: The Courageous Chronicle
    tw = draw.textbbox((0, 0), "The Courageous Chronicle", font=title_font)[2]
    draw.text(((WIDTH - tw) // 2, 105), "The Courageous Chronicle", fill="black", font=title_font)
    
    draw.text((920, 125), "MORNING", fill="black", font=banner_font)
    draw.text((920, 170), "FINAL", fill="black", font=banner_font)

    # Subtitle
    sub_text = "The World's Bravest Newspaper"
    sw = draw.textbbox((0, 0), sub_text, font=small_font)[2]
    draw.text(((WIDTH - sw) // 2, 185), sub_text, fill="#555555", font=small_font)

    # Bold Courage purple separator
    draw.line((40, 220, 1160, 220), fill="#8E24AA", width=8)

    # ── HEADLINE ──
    headline = news.get("headline", "").upper()
    draw_text_wrapped(draw, headline, (50, 240), headline_font, 1100, line_spacing=12)

    # ── NEWS PHOTO (left side) ──
    photo_bottom = 620
    if news.get("image_url"):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(news["image_url"], timeout=10)
                photo = Image.open(io.BytesIO(resp.content)).convert("RGB")
                photo = photo.resize((420, 300), Image.Resampling.LANCZOS)
                # Add a thin border to the photo
                photo = ImageOps.expand(photo, border=2, fill="black")
                img.paste(photo, (50, 320))
        except:
            # Placeholder if image fails
            draw.rectangle((50, 320, 470, 620), outline="black", width=2)
            draw.text((150, 450), "PHOTO\nMISSING", fill="#999999", font=banner_font, align="center")

    # ── STORY BOX (right side) ──
    story_text = news.get("story", "")[:450]
    if len(news.get("story", "")) > 450: story_text += "..."
    draw_text_wrapped(draw, story_text, (510, 330), body_font, 640, line_spacing=6)

    # ── SOURCE + TIME (under photo) ──
    source_line = f"The {news.get('source', 'Guardian')} • {news.get('time_ago', '7h ago')}"
    draw.text((50, 625), source_line, fill="#666666", font=small_font)

    # ── COURAGE BRANDING BOTTOM BAR ──
    draw.rectangle((0, 655, WIDTH, HEIGHT), fill="#8E24AA")
    draw.text((40, 665), "THE THINGS I DO FOR YOU PEOPLE... — COURAGE", fill="white", font=signature_font)

    # ── SUBTLE COURAGE HEAD (Bottom Right Overlay) ──
    if COURAGE_BASE_IMAGE_URL:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(COURAGE_BASE_IMAGE_URL, timeout=10)
                courage_head = Image.open(io.BytesIO(resp.content)).convert("RGBA")
                # Make it small and place in corner
                courage_head = courage_head.resize((120, 120), Image.Resampling.LANCZOS)
                img.paste(courage_head, (1060, 540), courage_head) # use alpha mask
        except:
            pass

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
