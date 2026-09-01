"""Provider interface for AI-generated media (images today, video later —
see gemini_image.py/registry.py for the current provider, and the project
plan for why video isn't wired up yet). Mirrors voice/tts.py's
TextToSpeech ABC shape, with one deliberate difference: a provider here
*raises* on failure rather than returning empty bytes — the caller is
always a tool_executor (see workers/task_worker.py's make_tool_executor),
and litellm_engine.py's tool loop already converts any raised exception
into a clean tool-error result the model can react to, so there's no need
for a second silent-failure protocol.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

# Deliberately not Python's `mimetypes` module — its extension mapping is
# inconsistent across platforms/minimal Docker images (e.g. jpeg aliasing).
# Small explicit allowlist instead, shared by the saving side (which
# extension to write) and the serving side (api/agents.py's files/raw
# route — which Content-Type to answer with).
MIME_TO_EXT: dict[str, str] = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
}
EXT_TO_MIME: dict[str, str] = {ext: mime for mime, ext in MIME_TO_EXT.items()}


@dataclass
class GeneratedMedia:
    data: bytes
    mime_type: str
    kind: Literal["image", "video"]


class MediaGenerator(ABC):
    @abstractmethod
    def is_configured(self) -> bool: ...

    @abstractmethod
    async def generate(self, prompt: str, **kwargs: object) -> GeneratedMedia:
        """Raises on failure (safety block, empty response, HTTP error,
        anything) — never returns a placeholder/empty result."""
