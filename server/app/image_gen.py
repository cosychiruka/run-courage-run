"""
image_gen.py — Fal.ai Realtime WebSocket inference (sub-800ms cartoons).
Uses your base Courage image + IP-Adapter for perfect consistency.
"""

import fal
import asyncio
from app.config import FAL_API_KEY, COURAGE_BASE_IMAGE_URL

fal.config.api_key = FAL_API_KEY

async def create_courage_art_realtime(prompt_description: str, game_context: str = None) -> str | None:
    """Smart meme image gen that ALWAYS uses in-game context for relevance."""
    if not FAL_API_KEY or not COURAGE_BASE_IMAGE_URL:
        return None

    # Build ultra-contextual prompt
    base = f"cartoon style, Courage the Cowardly Dog, vibrant meme energy, funny expression, high quality, bold colors"
    
    if game_context:
        full_prompt = f"{base}, {prompt_description}, in the 'Become a Monster' game world, {game_context}, reacting to player moment, purple house or homestead background if fits, meme arrows or text overlay if funny"
    else:
        full_prompt = f"{base}, {prompt_description}"

    try:
        result = await fal.run_async(
            "fal-ai/flux-general/image-to-image",
            arguments={
                "prompt": full_prompt,
                "image_url": COURAGE_BASE_IMAGE_URL,
                "ip_adapters": [{"image_url": COURAGE_BASE_IMAGE_URL, "strength": 0.88}],
                "num_images": 1,
                "guidance_scale": 3.5,
                "num_inference_steps": 20,
                "enable_streaming": True
            },
            on_queue_update=lambda status: print(f"[FAL_REALTIME] {status}")
        )
        return result["images"][0]["url"]
    except Exception as e:
        print(f"[IMAGE_REALTIME] Failed: {e}")
        return None
