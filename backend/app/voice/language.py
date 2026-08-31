"""Shared language-code helper for Sarvam's STT/TTS APIs."""


def to_bcp47(language: str) -> str:
    """Converts Cubicle's short language codes (Agent.voice_language, e.g.
    "en") to the BCP-47 form Sarvam's APIs require (e.g. "en-IN", per
    https://docs.sarvam.ai — both speech-to-text's language_code and
    text-to-speech's language_code list only region-qualified codes). A
    value that's already BCP-47 (or Sarvam's "unknown" auto-detect
    sentinel, 7 chars) passes through unchanged.
    """
    return f"{language}-IN" if len(language) == 2 else language
