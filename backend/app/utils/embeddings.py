"""Text embedding helpers, backed by the user's local Ollama install."""

import litellm

from app.config import get_settings


async def aembed_text(text: str) -> list[float]:
    """Embed a single string asynchronously (used on the request/response path)."""
    settings = get_settings()
    response = await litellm.aembedding(
        model=settings.embedding_model,
        input=[text],
        api_base=settings.ollama_base_url,
    )
    return response.data[0]["embedding"]


def embed_text(text: str) -> list[float]:
    """Embed a single string synchronously (used from Celery task bodies)."""
    settings = get_settings()
    response = litellm.embedding(
        model=settings.embedding_model,
        input=[text],
        api_base=settings.ollama_base_url,
    )
    return response.data[0]["embedding"]
