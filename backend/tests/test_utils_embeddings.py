"""Tests for app.utils.embeddings, with litellm mocked out."""

from types import SimpleNamespace

import pytest

from app.utils import embeddings as embeddings_module


async def test_aembed_text_calls_litellm_with_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = {}

    async def fake_aembedding(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(data=[{"embedding": [0.1, 0.2, 0.3]}])

    monkeypatch.setattr(embeddings_module.litellm, "aembedding", fake_aembedding)

    result = await embeddings_module.aembed_text("hello")

    assert result == [0.1, 0.2, 0.3]
    assert captured["model"] == "ollama/nomic-embed-text"
    assert captured["input"] == ["hello"]


def test_embed_text_calls_litellm_sync(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_embedding(**kwargs):
        return SimpleNamespace(data=[{"embedding": [0.4, 0.5]}])

    monkeypatch.setattr(embeddings_module.litellm, "embedding", fake_embedding)

    result = embeddings_module.embed_text("hi")

    assert result == [0.4, 0.5]
