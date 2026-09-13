import asyncio
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import main


class FakeWebSocket:
    def __init__(self, incoming):
        self.incoming = iter(incoming)
        self.text_messages = []
        self.binary_messages = []
        self.accepted = False

    async def accept(self):
        self.accepted = True

    async def receive(self):
        return next(self.incoming)

    async def send_text(self, value):
        self.text_messages.append(json.loads(value))

    async def send_bytes(self, value):
        self.binary_messages.append(value)


def voice_turn_messages():
    return [
        {"type": "websocket.receive", "bytes": b"browser-audio"},
        {"type": "websocket.receive", "text": json.dumps({"type": "voice_end"})},
        {"type": "websocket.disconnect"},
    ]


class VoiceWebSocketTests(unittest.IsolatedAsyncioTestCase):
    async def test_browser_tts_returns_reply_without_server_audio(self):
        ws = FakeWebSocket(voice_turn_messages())

        async def fake_transcribe(_audio):
            return "Hello Courage"

        async def fake_agent(**_kwargs):
            return "Hello from Nowhere."

        with (
            patch.object(main, "VOICE_TTS_MODE", "browser"),
            patch.object(main, "transcribe", fake_transcribe),
            patch.object(main, "run_agent", fake_agent),
        ):
            await main.voice_ws(ws, session="test-session")

        self.assertTrue(ws.accepted)
        self.assertEqual(ws.binary_messages, [])
        self.assertEqual(
            [message["type"] for message in ws.text_messages],
            ["transcript", "thinking", "done"],
        )
        self.assertEqual(ws.text_messages[-1]["reply"], "Hello from Nowhere.")
        self.assertEqual(ws.text_messages[-1]["audio_mode"], "browser")
        self.assertFalse(ws.text_messages[-1]["degraded"])

    async def test_agent_timeout_returns_spoken_recovery_instead_of_hanging(self):
        ws = FakeWebSocket(voice_turn_messages())

        async def fake_transcribe(_audio):
            return "Hello Courage"

        async def stalled_agent(**_kwargs):
            await asyncio.sleep(1)
            return "too late"

        with (
            patch.object(main, "VOICE_TTS_MODE", "browser"),
            patch.object(main, "VOICE_AGENT_TIMEOUT_SECONDS", 0.01),
            patch.object(main, "transcribe", fake_transcribe),
            patch.object(main, "run_agent", stalled_agent),
        ):
            await main.voice_ws(ws, session="timeout-session")

        done = ws.text_messages[-1]
        self.assertEqual(done["type"], "done")
        self.assertEqual(done["audio_mode"], "browser")
        self.assertTrue(done["degraded"])
        self.assertIn("brain got lost", done["reply"])


if __name__ == "__main__":
    unittest.main()
