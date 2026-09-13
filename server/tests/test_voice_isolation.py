import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import voice


class HangingWorker:
    def __init__(self):
        self.returncode = None
        self.terminated = False
        self.killed = False

    async def communicate(self):
        await asyncio.Event().wait()

    def terminate(self):
        self.terminated = True

    def kill(self):
        self.killed = True

    async def wait(self):
        self.returncode = -15
        return self.returncode


class VoiceIsolationTests(unittest.IsolatedAsyncioTestCase):
    async def test_low_memory_stt_terminates_worker_on_timeout(self):
        worker = HangingWorker()
        launcher = AsyncMock(return_value=worker)

        with (
            patch.object(voice, "VOICE_MEMORY_MODE", "low"),
            patch.object(voice, "VOICE_STT_TIMEOUT_SECONDS", 0.01),
            patch.object(voice.asyncio, "create_subprocess_exec", launcher),
        ):
            with self.assertRaises(asyncio.TimeoutError):
                await voice.transcribe(b"short browser audio")

        self.assertTrue(worker.terminated)
        self.assertFalse(worker.killed)


if __name__ == "__main__":
    unittest.main()
