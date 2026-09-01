"""Gemini image generation ("Nano Banana") via the standard generateContent
endpoint — NOT the dedicated Imagen `:predict` endpoint, which Google is
retiring in favor of this one. Per
https://ai.google.dev/gemini-api/docs/image-generation and
https://firebase.google.com/docs/ai-logic/generate-images-gemini (checked
live, not guessed): request/response shape is the same
contents[].parts[]/candidates[].content.parts[] shape as text generation,
just with an image-capable model and an inlineData part in the response
instead of (or alongside) a text part.
"""

import base64

import httpx
import structlog

from app.media.base import GeneratedMedia, MediaGenerator

logger = structlog.get_logger()

GEMINI_GENERATE_CONTENT_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)
# "Nano Banana 2" — current per Google's own docs as of this writing. A
# single named constant rather than buried in the request builder so it's
# a one-line change if Google renames/deprecates it later.
GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image"


class GeminiImageGenerationError(Exception):
    """Raised for any failure mode — safety block, empty response, HTTP
    error. litellm_engine.py's tool loop already turns a raised exception
    into a clean tool-error result the model sees, so there's nothing
    consumers of this class need to catch specially."""


class GeminiImageGenerator(MediaGenerator):
    def __init__(self, api_key: str | None) -> None:
        self.api_key = api_key

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def generate(self, prompt: str, **kwargs: object) -> GeneratedMedia:
        if not self.api_key:
            raise GeminiImageGenerationError("No Gemini API key configured.")

        url = GEMINI_GENERATE_CONTENT_URL.format(model=GEMINI_IMAGE_MODEL)
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    url,
                    headers={"x-goog-api-key": self.api_key},
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                # The body is where Gemini actually says what's wrong (bad
                # key, model not found, quota) — same lesson learned the
                # hard way with Sarvam earlier this session: str(exc) alone
                # is just "400 Bad Request", not enough to diagnose.
                logger.warning(
                    "gemini_image_generation_failed",
                    status=exc.response.status_code,
                    body=exc.response.text,
                )
                raise GeminiImageGenerationError(
                    f"Gemini API error {exc.response.status_code}: {exc.response.text}"
                ) from exc
            except httpx.HTTPError as exc:
                logger.warning("gemini_image_generation_failed", error=str(exc))
                raise GeminiImageGenerationError(f"Gemini API request failed: {exc}") from exc

        body = response.json()
        candidates = body.get("candidates") or []
        if not candidates:
            raise GeminiImageGenerationError("Gemini returned no candidates.")

        candidate = candidates[0]
        finish_reason = candidate.get("finishReason")
        if finish_reason not in (None, "STOP"):
            raise GeminiImageGenerationError(
                f"Gemini declined to generate an image (finishReason={finish_reason})."
            )

        parts = candidate.get("content", {}).get("parts") or []
        image_part = next((p for p in parts if "inlineData" in p), None)
        if image_part is None:
            raise GeminiImageGenerationError(
                "Gemini's response had no image data — it may have replied with text only."
            )

        inline = image_part["inlineData"]
        return GeneratedMedia(
            data=base64.b64decode(inline["data"]),
            mime_type=inline.get("mimeType", "image/png"),
            kind="image",
        )
