"""Disposable faster-whisper worker for the 1 GB production profile."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="tiny.en")
    parser.add_argument("--beam-size", type=int, default=1)
    args = parser.parse_args()

    # Set native thread caps before importing the inference runtime.
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

    try:
        from faster_whisper import WhisperModel

        model = WhisperModel(
            args.model,
            device="cpu",
            compute_type="int8",
            cpu_threads=1,
            num_workers=1,
        )
        segments, _info = model.transcribe(
            args.audio,
            language="en",
            beam_size=max(1, args.beam_size),
            vad_filter=True,
        )
        text = " ".join(segment.text for segment in segments).strip()
        Path(args.output).write_text(
            json.dumps({"text": text}, ensure_ascii=False),
            encoding="utf-8",
        )
        return 0
    except Exception as exc:
        print(f"{type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
