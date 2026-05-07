"""
image_gen.py — Fal.ai Realtime with MULTIPLE references (Courage base + news image).
Perfect for turning real news photos into Courage memes.
"""

import fal
import asyncio
from app.config import FAL_API_KEY, COURAGE_BASE_IMAGE_URL

fal.config.api_key = FAL_API_KEY

async def create_courage_art_realtime(
    prompt_description: str, 
    news_image_url: str | None = None,
    game_context: str = None
) -> str | None:
    """Smart multi-reference generation: Courage base + optional news image + game context."""
    if not FAL_API_KEY or not COURAGE_BASE_IMAGE_URL:
        return None

    base_prompt = (
        f"cartoon style, Courage the Cowardly Dog, vibrant meme energy, "
        f"funny expression, high quality, bold colors, dramatic action"
    )

    full_prompt = f"{base_prompt}, {prompt_description}"
    if game_context:
        full_prompt += f", in the 'Become a Monster' game world, {game_context}"

    # Multiple IP-Adapters — this is the magic
    ip_adapters = [
        {"image_url": COURAGE_BASE_IMAGE_URL, "strength": 0.88},   # Courage character lock
    ]

    if news_image_url:
        ip_adapters.append({
            "image_url": news_image_url,
            "strength": 0.45   # scene + composition reference
        })
        full_prompt += ", recreating the exact scene and energy from the reference news photo"

    try:
        result = await fal.run_async(
            "fal-ai/flux-general/image-to-image",
            arguments={
                "prompt": full_prompt,
                "image_url": COURAGE_BASE_IMAGE_URL,
                "ip_adapters": ip_adapters,
                "num_images": 1,
                "guidance_scale": 3.5,
                "num_inference_steps": 20,
                "enable_streaming": True
            },
            on_queue_update=lambda status: print(f"[FAL_REALTIME] {status}")
        )
        return result["images"][0]["url"]
    except Exception as e:
        print(f"[IMAGE_REALTIME] Multi-reference failed: {e}")
        return None
