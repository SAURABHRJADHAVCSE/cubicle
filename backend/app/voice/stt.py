"""Speech-to-text provider interface. `is_configured()` gates the real
pipeline vs. the test-tone/echo fallback in pipeline.py — same "not
configured" pattern as app/engines/registry.py's engine detection."""

from abc import ABC, abstractmethod

import httpx
import structlog

logger = structlog.get_logger()

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"


class SpeechToText(ABC):
    @abstractmethod
    def is_configured(self) -> bool: ...

    @abstractmethod
    async def transcribe(self, pcm_16k_mono: bytes) -> str:
        """Transcribes a single utterance of 16kHz mono s16 PCM audio."""


class SarvamSTT(SpeechToText):
    def __init__(self, api_key: str | None) -> None:
        self.api_key = api_key

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def transcribe(self, pcm_16k_mono: bytes) -> str:
        if not self.api_key:
            return ""
        # Sarvam's Saarika API expects a WAV upload; PCM -> minimal WAV
        # header, no external dependency needed for something this small.
        wav_bytes = _pcm_to_wav(pcm_16k_mono, sample_rate=16000)
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(
                    SARVAM_STT_URL,
                    headers={"api-subscription-key": self.api_key},
                    files={"file": ("audio.wav", wav_bytes, "audio/wav")},
                    data={"model": "saarika:v2"},
                )
                response.raise_for_status()
                return response.json().get("transcript", "").strip()
            except httpx.HTTPError as exc:
                logger.warning("sarvam_stt_failed", error=str(exc))
                return ""


def _pcm_to_wav(pcm: bytes, sample_rate: int) -> bytes:
    import struct

    num_channels = 1
    bits_per_sample = 16
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + len(pcm),
        b"WAVE",
        b"fmt ",
        16,
        1,  # PCM
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        len(pcm),
    )
    return header + pcm
