"""
news_poster.py — Pixel-perfect, high-quality newspaper generator.
Guardian = classic style. CoinDesk = neon crypto mode.
Replaces tweet_image.py entirely.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import httpx
import time
import os
import io
from app.config import DB_PATH, COURAGE_BASE_IMAGE_URL

async def generate_news_poster_image(news: dict) -> Image.Image:
    """Core logic to build the PIL Image object."""
    WIDTH, HEIGHT = 1200, 675
    is_crypto = news.get("is_crypto") or news.get("source", "").lower() in ("coindesk", "crypto")

    # Background
    bg_color = "#0D0D0D" if is_crypto else "#F5F0E8" # Deep black for crypto, beige for general
    img = Image.new("RGB", (WIDTH, HEIGHT), color=bg_color)
    draw = ImageDraw.Draw(img)

    # Advanced fonts with fallback
    try:
        title_font = ImageFont.truetype("arialbd.ttf", 68)
        headline_font = ImageFont.truetype("arialbd.ttf", 54)
        body_font = ImageFont.truetype("arial.ttf", 28)
        small_font = ImageFont.truetype("arialbd.ttf", 24)
        banner_font = ImageFont.truetype("arialbd.ttf", 42)
    except:
        title_font = headline_font = body_font = small_font = banner_font = ImageFont.load_default()

    # Shadow helper
    def draw_text_with_shadow(text, pos, font, fill, shadow_color="#000000", shadow_offset=3, max_width=None):
        x, y = pos
        lines = [text]
        if max_width:
            lines = []
            words = text.split()
            while words:
                line = ''
                while words and draw.textbbox((0,0), line + words[0], font=font)[2] <= max_width:
                    line += words.pop(0) + ' '
                lines.append(line.strip())
        
        for line in lines:
            # Shadow
            draw.text((x + shadow_offset, y + shadow_offset), line, font=font, fill=shadow_color)
            # Main text
            draw.text((x, y), line, font=font, fill=fill)
            y += font.size + 10

    # ── TOP BANNER ──
    banner_color = "#D32F2F" if not is_crypto else "#8E24AA"  # Red vs Courage Purple
    draw.rectangle((0, 0, WIDTH, 95), fill=banner_color)
    
    ticker_text = "MemeNews MemeNews MemeNews MemeNews" if not is_crypto else "CRYPTO SURGE $RCR $SOL $RCR $SOL"
    draw_text_with_shadow(ticker_text, (30, 18), title_font, "#FFFFFF", shadow_color="#330000" if not is_crypto else "#000000")

    # Separator
    draw.line((30, 98, 1170, 98), fill="black" if not is_crypto else "#00FF9F", width=4)

    # EXTRA! + TITLE + MORNING FINAL
    accent_color = "black" if not is_crypto else "#00FF9F"
    draw_text_with_shadow("EXTRA! EXTRA!", (50, 110), banner_font, accent_color)
    draw_text_with_shadow("The Courageous Chronicle", (340, 105), title_font, accent_color)
    draw_text_with_shadow("MORNING FINAL", (920, 115), banner_font, accent_color)

    sub_color = "#555555" if not is_crypto else "#00FF9F"
    draw_text_with_shadow("The World's Bravest Newspaper", (410, 175), small_font, sub_color)

    # Purple separator (Courage signature)
    draw.line((40, 210, 1160, 210), fill="#8E24AA", width=10)

    # ── HEADLINE ──
    headline_color = "black" if not is_crypto else "#00FF9F"
    draw_text_with_shadow(news.get("headline", "").upper(), (50, 240), headline_font, headline_color, max_width=1100)

    # ── PHOTO (rounded corners + shadow) ──
    if news.get("image_url"):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(news["image_url"], timeout=10)
                photo = Image.open(io.BytesIO(resp.content)).convert("RGB")
                photo = photo.resize((420, 300), Image.Resampling.LANCZOS)
                
                # Rounded corners mask
                mask = Image.new("L", photo.size, 0)
                mask_draw = ImageDraw.Draw(mask)
                mask_draw.rounded_rectangle((0, 0, photo.width, photo.height), radius=30, fill=255)
                photo.putalpha(mask)
                
                # Subtle shadow
                shadow = Image.new("RGBA", (430, 310), (0, 0, 0, 100))
                img.paste(shadow, (55, 325), shadow)
                img.paste(photo, (50, 320), photo)
        except:
            # Fallback
            draw.rectangle((50, 320, 470, 620), outline=accent_color, width=2)
            draw.text((150, 450), "SIGNAL\nLOST", fill=accent_color, font=banner_font, align="center")

    # ── STORY TEXT ──
    story = news.get("story", "")[:420] + "..." if len(news.get("story", "")) > 420 else news.get("story", "")
    story_color = "black" if not is_crypto else "#FFFFFF"
    draw_text_with_shadow(story, (510, 330), body_font, story_color, max_width=640)

    # Source + time
    source_line = f"{news.get('source', 'Guardian')} • {news.get('time_ago', 'now')}"
    draw_text_with_shadow(source_line, (70, 620), small_font, "#666666" if not is_crypto else "#00FF9F")

    # ── COURAGE BOTTOM BAR ──
    bar_color = "#8E24AA"
    draw.rectangle((0, 640, WIDTH, HEIGHT), fill=bar_color)
    draw_text_with_shadow("THE THINGS I DO FOR YOU PEOPLE... — COURAGE", (50, 650), small_font, "white")

    # Crypto flair: tiny chart emoji
    if is_crypto:
        draw.text((1100, 645), "📈", font=banner_font)

    # ── SUBTLE COURAGE HEAD OVERLAY ──
    if COURAGE_BASE_IMAGE_URL:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(COURAGE_BASE_IMAGE_URL, timeout=10)
                courage_head = Image.open(io.BytesIO(resp.content)).convert("RGBA")
                courage_head = courage_head.resize((120, 120), Image.Resampling.LANCZOS)
                img.paste(courage_head, (1060, 530), courage_head)
        except:
            pass

    return img

async def generate_news_poster(news: dict) -> str:
    """Returns public URL to the finished poster."""
    img = await generate_news_poster_image(news)
    filename = f"courage_news_{'crypto' if (news.get('is_crypto') or news.get('source', '').lower() == 'coindesk') else 'general'}_{int(time.time())}.png"
    os.makedirs("public/news_posters", exist_ok=True)
    img.save(f"public/news_posters/{filename}", quality=98, optimize=True)
    return f"https://runcouragerun.life/public/news_posters/{filename}"

async def generate_news_poster_bytes(news: dict) -> bytes:
    """Returns raw PNG bytes."""
    img = await generate_news_poster_image(news)
    buf = io.BytesIO()
    img.save(buf, format="PNG", quality=98)
    return buf.getvalue()
