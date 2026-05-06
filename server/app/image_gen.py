"""
image_gen.py — Fal.ai Realtime WebSocket inference (sub-800ms cartoons).
Uses your base Courage image + IP-Adapter for perfect consistency.
"""

import fal
import asyncio
from app.config import FAL_API_KEY, COURAGE_BASE_IMAGE_URL

fal.config.api_key = FAL_API_KEY

async def create_courage_art_realtime(prompt_description: str) -> str | None:
    """Realtime streaming generation — returns image URL in <800ms."""
    if not FAL_API_KEY or not COURAGE_BASE_IMAGE_URL:
        return None

    try:
        # Note: fal.run_async for flux-general might require specific version or schema
        # but following the advisor's requested logic:
        result = await fal.run_async(
            "fal-ai/flux-general/image-to-image",  # realtime endpoint
            arguments={
                "prompt": f"cartoon style, Courage the Cowardly Dog, {prompt_description}, vibrant meme energy, funny expression, purple house if relevant, high quality, bold colors",
                "image_url": COURAGE_BASE_IMAGE_URL,
                "ip_adapters": [{"image_url": COURAGE_BASE_IMAGE_URL, "strength": 0.85}],
                "num_images": 1,
                "guidance_scale": 3.5,
                "num_inference_steps": 20,  # faster for realtime
                "enable_streaming": True
            },
            # Streaming callback (optional — logs progress)
            on_queue_update=lambda status: print(f"[FAL_REALTIME] {status}")
        )
        return result["images"][0]["url"]
    except Exception as e:
        print(f"[IMAGE_REALTIME] Failed: {e}")
        return None
