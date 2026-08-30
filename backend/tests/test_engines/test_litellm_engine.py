"""Tests for LiteLLMEngine, with litellm.acompletion mocked out."""

import asyncio
from types import SimpleNamespace

import pytest

from app.engines import litellm_engine as litellm_engine_module
from app.engines.litellm_engine import LiteLLMEngine


def _fake_response(content: str = "hi there", total_tokens: int = 42) -> SimpleNamespace:
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        usage=SimpleNamespace(total_tokens=total_tokens),
    )


async def test_execute_returns_engine_result(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_acompletion(**kwargs):
        assert kwargs["model"] == "claude-sonnet-4-5"
        return _fake_response()

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)
    monkeypatch.setattr(litellm_engine_module.litellm, "completion_cost", lambda r: 0.001)

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    result = await engine.execute("say hi", context={"system_prompt": "be nice"})

    assert result.output == "hi there"
    assert result.tokens_used == 42
    assert result.cost_usd == 0.001


async def test_execute_handles_cost_lookup_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_acompletion(**kwargs):
        return _fake_response()

    def fake_cost(_response):
        raise ValueError("no pricing for this model")

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)
    monkeypatch.setattr(litellm_engine_module.litellm, "completion_cost", fake_cost)

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    result = await engine.execute("say hi", context={})

    assert result.cost_usd == 0.0


async def test_execute_raises_on_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_settings = SimpleNamespace(task_timeout_seconds=0.05)
    monkeypatch.setattr(litellm_engine_module, "get_settings", lambda: fake_settings)

    async def fake_acompletion(**kwargs):
        await asyncio.sleep(999)
        raise AssertionError("should have been cancelled by wait_for's timeout")

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    with pytest.raises(RuntimeError, match="timed out"):
        await engine.execute("say hi", context={})


async def test_chat_stream_yields_deltas(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_stream():
        for content in ["Hel", "lo", None, "!"]:
            yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=content))])

    async def fake_acompletion(**kwargs):
        assert kwargs["stream"] is True
        return fake_stream()

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    deltas = [d async for d in engine.chat_stream("hi", history=[])]

    assert deltas == ["Hel", "lo", "!"]


async def test_chat_concatenates_stream(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_stream():
        for content in ["a", "b", "c"]:
            yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=content))])

    async def fake_acompletion(**kwargs):
        return fake_stream()

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    assert await engine.chat("hi", history=[]) == "abc"


def test_get_models_routes_by_provider() -> None:
    assert "claude-sonnet-4-5" in LiteLLMEngine(model="claude-sonnet-4-5").get_models()
    assert "llama3.2" in LiteLLMEngine(model="ollama/llama3.2").get_models()


async def test_is_available_anthropic_checks_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_settings = SimpleNamespace(anthropic_api_key="sk-test", ollama_base_url="unused")
    monkeypatch.setattr(litellm_engine_module, "get_settings", lambda: fake_settings)

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    assert await engine.is_available() is True

    fake_settings.anthropic_api_key = None
    assert await engine.is_available() is False


async def test_is_available_ollama_checks_server(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_check_ollama(base_url: str) -> bool:
        assert base_url == "http://ollama:11434"
        return True

    monkeypatch.setattr(litellm_engine_module, "check_ollama", fake_check_ollama)

    engine = LiteLLMEngine(model="ollama/llama3.2", api_base="http://ollama:11434")
    assert await engine.is_available() is True
