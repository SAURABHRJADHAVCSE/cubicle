"""Text-to-speech provider interface — see stt.py's docstring for the
"not configured" pattern this mirrors."""

import base64
from abc import ABC, abstractmethod

import httpx
import structlog

logger = structlog.get_logger()

SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"

# Sarvam Bulbul speaker names, chosen per agent.voice_gender — arbitrary
# picks from Sarvam's published voice list; swap freely once real usage
# surfaces a preference.
_SPEAKER_BY_GENDER = {"male": "abhilash", "female": "anushka"}
_PACE_MULTIPLIER = {"slow": 0.85, "medium": 1.0, "fast": 1.2}


class TextToSpeech(ABC):
    @abstractmethod
    def is_configured(self) -> bool: ...

    @abstractmethod
    async def synthesize(self, text: str, language: str, gender: str, pace: str) -> tuple[bytes, int]:
        """Returns (pcm_s16_mono_bytes, sample_rate)."""


class SarvamTTS(TextToSpeech):
    def __init__(self, api_key: str | None) -> None:
        self.api_key = api_key

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def synthesize(self, text: str, language: str, gender: str, pace: str) -> tuple[bytes, int]:
        if not self.api_key:
            return b"", 0
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(
                    SARVAM_TTS_URL,
                    headers={"api-subscription-key": self.api_key},
                    json={
                        "text": text[:1500],  # Sarvam's per-request character cap
                        "target_language_code": f"{language}-IN" if len(language) == 2 else language,
                        "speaker": _SPEAKER_BY_GENDER.get(gender, "anushka"),
                        "pace": _PACE_MULTIPLIER.get(pace, 1.0),
                        "speech_sample_rate": 16000,
                        "audio_format": "wav",
                    },
                )
                response.raise_for_status()
                audios = response.json().get("audios", [])
                if not audios:
                    return b"", 0
                wav_bytes = base64.b64decode(audios[0])
                return _wav_to_pcm(wav_bytes)
            except httpx.HTTPError as exc:
                logger.warning("sarvam_tts_failed", error=str(exc))
                return b"", 0


def _wav_to_pcm(wav_bytes: bytes) -> tuple[bytes, int]:
    """Minimal WAV reader — just enough to pull PCM data + sample rate back
    out of Sarvam's response without a new dependency."""
    import struct

    if wav_bytes[:4] != b"RIFF" or wav_bytes[8:12] != b"WAVE":
        return b"", 0

    sample_rate = 16000
    pos = 12
    while pos + 8 <= len(wav_bytes):
        chunk_id = wav_bytes[pos : pos + 4]
        (chunk_size,) = struct.unpack("<I", wav_bytes[pos + 4 : pos + 8])
        body_start = pos + 8
        if chunk_id == b"fmt ":
            (sample_rate,) = struct.unpack("<I", wav_bytes[body_start + 4 : body_start + 8])
        elif chunk_id == b"data":
            return wav_bytes[body_start : body_start + chunk_size], sample_rate
        pos = body_start + chunk_size + (chunk_size % 2)
    return b"", sample_rate
