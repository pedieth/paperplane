#!/usr/bin/env python3
"""PaperPlane STT worker - local Whisper transcription for voice replies.
Written during the hackathon build window (Nov 23-29, 2026).

Why this exists: the glasses record a voice reply as PCM frames and the
plugin uploads them to the backend as a transcription job
(POST /api/voice/transcribe). Transcription happens here, on this VM,
with faster-whisper (small model, CPU) - fully local, no external keys,
no paid APIs. The worker claims jobs through the bridge-only ingest
endpoints (same shared secret as the Telegram bridge), writes the PCM
to a WAV, transcribes it, and posts the text back to
POST /api/ingest/voice-result, where the plugin picks it up for the
on-lens approval screen.

Audio format: the lens delivers 16 kHz, 16-bit, mono PCM (the Even Hub
audio path). The plugin uploads it base64-encoded.

Config (environment):
  API_BASE       backend base URL (default http://127.0.0.1:8787)
  BRIDGE_SECRET  shared secret for the ingest endpoints
  WHISPER_MODEL  model name (default small)
  POLL_S         poll interval in seconds (default 1)
"""

import base64
import json
import os
import sys
import time
import traceback
import urllib.request

API_BASE = os.environ.get("API_BASE", "http://127.0.0.1:8787")
BRIDGE_SECRET = os.environ.get("BRIDGE_SECRET", "dev-bridge-secret-change-me")
MODEL_NAME = os.environ.get("WHISPER_MODEL", "small")
POLL_S = float(os.environ.get("POLL_S", "1"))

SAMPLE_RATE = 16000


def log(*args):
    print(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "[paperplane-stt]", *args, flush=True)


def api(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=data,
        method=method,
        headers={
            "content-type": "application/json",
            "authorization": f"Bearer {BRIDGE_SECRET}",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def pcm_to_samples(pcm: bytes):
    """Raw 16 kHz 16-bit mono PCM -> float32 samples for Whisper.

    Feeding samples directly keeps PyAV out of the path entirely: the
    faster-whisper/PyAV pair on this VM disagrees on an av.open keyword
    (metadata_errors), which broke file-based transcription on Day 4.
    """
    import numpy as np

    return np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0


def main():
    from faster_whisper import WhisperModel

    log("loading model", MODEL_NAME, "(cpu, int8)")
    model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
    log("model ready, polling", API_BASE)

    while True:
        try:
            data = api("/api/ingest/voice-jobs")
            for job in data.get("jobs", []):
                job_id = job["jobId"]
                pcm = base64.b64decode(job["audioBase64"])
                seconds = len(pcm) / (SAMPLE_RATE * 2)
                started = time.time()
                segments, _info = model.transcribe(
                    pcm_to_samples(pcm),
                    language="en",
                    beam_size=1,
                    condition_on_previous_text=False,
                )
                text = " ".join(segment.text.strip() for segment in segments).strip()
                elapsed = time.time() - started
                log(f"job {job_id}: {len(pcm)} bytes ({seconds:.1f}s audio) "
                    f"transcribed in {elapsed:.1f}s -> {text!r}")
                api("/api/ingest/voice-result", method="POST",
                    body={"jobId": job_id, "text": text})
        except Exception:  # keep the loop alive through API restarts
            log("poll cycle failed:\n" + traceback.format_exc())
        time.sleep(POLL_S)


if __name__ == "__main__":
    sys.exit(main())
