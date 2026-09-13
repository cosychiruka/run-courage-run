import unittest
from pathlib import Path
import sys
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import image_gen


class ImageGenerationClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_hosted_generation_uses_lightweight_client(self):
        run = AsyncMock(return_value={"images": [{"url": "https://example.test/courage.png"}]})

        with (
            patch.object(image_gen, "FAL_API_KEY", "test-key"),
            patch.object(image_gen, "COURAGE_BASE_IMAGE_URL", "https://example.test/base.png"),
            patch("fal_client.AsyncClient") as client_type,
        ):
            client_type.return_value.run = run
            result = await image_gen.create_courage_art("following an emerald trail")

        self.assertEqual(result, "https://example.test/courage.png")
        client_type.assert_called_once_with(key="test-key")
        run.assert_awaited_once()
        self.assertEqual(run.await_args.args[0], "fal-ai/flux/dev/image-to-image")


if __name__ == "__main__":
    unittest.main()
