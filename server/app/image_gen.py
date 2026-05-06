"""
image_gen.py — FLUX via fal.ai + IP-Adapter for perfect Courage cartoon consistency.
"""

import fal
import os
from app.config import FAL_API_KEY, COURAGE_BASE_IMAGE_URL

fal.config.api_key = FAL_API_KEY

async def create_courage_art(prompt_description: str) -> str | None:
    """Generate cartoon of Courage based on your description + base image."""
    if not FAL_API_KEY or not COURAGE_BASE_IMAGE_URL:
        return None

    try:
        result = fal.run(
            "fal-ai/flux-general/image-to-image",
            arguments={
                "prompt": f"cartoon style, Courage the Cowardly Dog, {prompt_description}, vibrant meme energy, funny expression, purple house if relevant, high quality, bold colors",
                "image_url": COURAGE_BASE_IMAGE_URL,
                "ip_adapters": [{"image_url": COURAGE_BASE_IMAGE_URL, "strength": 0.85}],
                "num_images": 1,
                "guidance_scale": 3.5,
                "num_inference_steps": 28,
            }
        )
        return result["images"][0]["url"]
    except Exception as e:
        print(f"[IMAGE_GEN] Failed: {e}")
        return None
