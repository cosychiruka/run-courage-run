"""
image_gen.py — Fal.ai image generation for Courage.
Phase 6.2: Smarter Art Prompts with high-fidelity character locking.
"""

import os
import fal
import asyncio
from app.config import FAL_API_KEY, COURAGE_BASE_IMAGE_URL

fal.config.api_key = FAL_API_KEY

async def create_courage_art(prompt: str, sentiment: str = "neutral"):
    """Accurate Courage character + sentiment-aware prompt (Phase 6.2)"""
    if not FAL_API_KEY or not COURAGE_BASE_IMAGE_URL:
        print("[IMAGE_GEN] Missing FAL_API_KEY or COURAGE_BASE_IMAGE_URL")
        return None

    base_character = (
        "Courage, the pink cartoon dog from Courage the Cowardly Dog, "
        "large bulging white eyes with small black pupils and heavy black eyebrows, "
        "very expressive and slightly nervous face, floppy brown-lined dog ears, "
        "small black nose, wide open mouth with bright pink tongue and visible teeth, "
        "two small pink flower accessories with blue centers on top of his head, "
        "thin pink arms ending in three-fingered star-shaped hands, "
        "rounded pink body with a small black spot on his belly, "
        "clean bold 2D cartoon style, vibrant colors, sharp outlines, highly stylized and emotive"
    )
    
    enhanced_prompt = f"{base_character}. {prompt}. Current mood: {sentiment}. Style: fun, meme energy, highly expressive face, perfect cartoon proportions."
    
    try:
        # Use flux-general or image-to-image for character consistency
        result = await fal.run_async(
            "fal-ai/flux/dev/image-to-image",
            arguments={
                "image_url": COURAGE_BASE_IMAGE_URL,
                "prompt": enhanced_prompt,
                "strength": 0.82,
                "num_images": 1
            }
        )
        return result["images"][0]["url"]
    except Exception as e:
        print(f"[IMAGE_GEN] Fal.ai generation failed: {e}")
        return None

async def create_courage_art_realtime(
    prompt_description: str, 
    news_image_url: str | None = None,
    game_context: str = None
) -> str | None:
    """Smart multi-reference generation (Fallback/Legacy)."""
    return await create_courage_art(prompt_description)
