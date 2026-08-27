"""Provider selection — mirrors app/engines/registry.py's pattern. Only
one STT/TTS provider exists today (Sarvam); the interface in stt.py/tts.py
means adding a second is additive here, not a rewrite."""

from app.config import get_settings
from app.voice.stt import SarvamSTT, SpeechToText
from app.voice.tts import SarvamTTS, TextToSpeech


def get_stt_provider() -> SpeechToText:
    return SarvamSTT(api_key=get_settings().sarvam_api_key)


def get_tts_provider() -> TextToSpeech:
    return SarvamTTS(api_key=get_settings().sarvam_api_key)
