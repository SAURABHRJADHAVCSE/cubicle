"""Veo video generation via the Gemini API — a genuinely different
interaction shape than image generation: submit a job (predictLongRunning),
then poll an operation until it's done. Per
https://ai.google.dev/gemini-api/docs/veo (checked live, not guessed).
"""

import asyncio

import httpx
import structlog

from app.config import get_settings
from app.media.base import GeneratedMedia, MediaGenerator

logger = structlog.get_logger()

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
# Same generation as the image model's "Nano Banana 2" naming era — a
# single named constant, one-line change if Google renames/deprecates it.
VEO_MODEL = "veo-3.1-generate-preview"

_POLL_INITIAL_DELAY_S = 1.0
_POLL_MAX_DELAY_S = 10.0
# Video generation runs inside a Celery task bounded by task_timeout_seconds
# (litellm_engine.py's tool loop wraps the whole call in that timeout) — we
# must give up on our own polling well before that limit hits, leaving
# headroom for the model's follow-up turn after the tool result comes back,
# rather than let a Celery SIGKILL be what actually ends this.
_POLL_HEADROOM_S = 120
_POLL_MAX_WAIT_S = 400


class GeminiVideoGenerationError(Exception):
    """Raised for any failure mode — see gemini_image.py's identical
    reasoning for why raising (not returning empty bytes) is correct here:
    litellm_engine.py's tool loop already turns this into a clean
    tool-error result the model can react to."""


class GeminiVideoGenerator(MediaGenerator):
    def __init__(self, api_key: str | None) -> None:
        self.api_key = api_key

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _max_wait_seconds(self) -> float:
        configured = get_settings().task_timeout_seconds
        return max(60.0, min(float(configured - _POLL_HEADROOM_S), _POLL_MAX_WAIT_S))

    async def generate(self, prompt: str, **kwargs: object) -> GeneratedMedia:
        if not self.api_key:
            raise GeminiVideoGenerationError("No Gemini API key configured.")

        headers = {"x-goog-api-key": self.api_key}
        async with httpx.AsyncClient(timeout=60.0) as client:
            operation_name = await self._start(client, headers, prompt)
            video_uri = await self._poll_until_done(client, headers, operation_name)
            return await self._download(client, headers, video_uri)

    async def _start(self, client: httpx.AsyncClient, headers: dict, prompt: str) -> str:
        url = f"{GEMINI_API_BASE}/models/{VEO_MODEL}:predictLongRunning"
        try:
            response = await client.post(
                url, headers=headers, json={"instances": [{"prompt": prompt}]}
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "gemini_video_generation_failed",
                stage="start",
                status=exc.response.status_code,
                body=exc.response.text,
            )
            raise GeminiVideoGenerationError(
                f"Gemini API error {exc.response.status_code}: {exc.response.text}"
            ) from exc
        except httpx.HTTPError as exc:
            logger.warning("gemini_video_generation_failed", stage="start", error=str(exc))
            raise GeminiVideoGenerationError(f"Gemini API request failed: {exc}") from exc

        name = response.json().get("name")
        if not name:
            raise GeminiVideoGenerationError("Gemini didn't return an operation to poll.")
        return name

    async def _poll_until_done(
        self, client: httpx.AsyncClient, headers: dict, operation_name: str
    ) -> str:
        # Exponential backoff per Google's own guidance for this endpoint —
        # 1s up to 10s between polls.
        delay = _POLL_INITIAL_DELAY_S
        elapsed = 0.0
        max_wait = self._max_wait_seconds()
        url = f"{GEMINI_API_BASE}/{operation_name}"

        while elapsed < max_wait:
            await asyncio.sleep(delay)
            elapsed += delay
            delay = min(delay * 2, _POLL_MAX_DELAY_S)

            try:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                logger.warning(
                    "gemini_video_generation_failed",
                    stage="poll",
                    status=exc.response.status_code,
                    body=exc.response.text,
                )
                raise GeminiVideoGenerationError(
                    f"Gemini API error {exc.response.status_code}: {exc.response.text}"
                ) from exc
            except httpx.HTTPError as exc:
                logger.warning("gemini_video_generation_failed", stage="poll", error=str(exc))
                raise GeminiVideoGenerationError(f"Gemini API request failed: {exc}") from exc

            body = response.json()
            if not body.get("done"):
                continue

            if "error" in body:
                raise GeminiVideoGenerationError(f"Video generation failed: {body['error']}")

            try:
                samples = body["response"]["generateVideoResponse"]["generatedSamples"]
                return samples[0]["video"]["uri"]
            except (KeyError, IndexError) as exc:
                raise GeminiVideoGenerationError(
                    "Gemini finished but returned no video."
                ) from exc

        raise GeminiVideoGenerationError(
            f"Video generation didn't finish within {max_wait:.0f}s — try a shorter/simpler prompt."
        )

    async def _download(
        self, client: httpx.AsyncClient, headers: dict, video_uri: str
    ) -> GeneratedMedia:
        try:
            response = await client.get(video_uri, headers=headers)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("gemini_video_generation_failed", stage="download", error=str(exc))
            raise GeminiVideoGenerationError(f"Downloading the generated video failed: {exc}") from exc

        return GeneratedMedia(
            data=response.content,
            mime_type=response.headers.get("content-type", "video/mp4"),
            kind="video",
        )
