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

    # A pre-set api_key short-circuits _resolve_api_key() before it ever
    # reaches get_settings().anthropic_api_key (not on this test's
    # deliberately-narrow fake_settings) or a real DB call — this test is
    # about timeout behavior, not key resolution.
    engine = LiteLLMEngine(model="claude-sonnet-4-5", api_key="unused-in-this-test")
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


async def test_execute_forwards_custom_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = {}

    async def fake_acompletion(**kwargs):
        captured.update(kwargs)
        return _fake_response()

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)
    monkeypatch.setattr(litellm_engine_module.litellm, "completion_cost", lambda r: 0.0)

    engine = LiteLLMEngine(model="gemini/gemini-1.5-pro", api_key="sk-my-key")
    await engine.execute("hi", context={})

    assert captured["api_key"] == "sk-my-key"


async def test_execute_omits_api_key_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = {}

    async def fake_acompletion(**kwargs):
        captured.update(kwargs)
        return _fake_response()

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)
    monkeypatch.setattr(litellm_engine_module.litellm, "completion_cost", lambda r: 0.0)

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    await engine.execute("hi", context={})

    assert "api_key" not in captured


async def test_chat_stream_forwards_custom_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = {}

    async def fake_stream():
        yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content="hi"))])

    async def fake_acompletion(**kwargs):
        captured.update(kwargs)
        return fake_stream()

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)

    engine = LiteLLMEngine(model="gemini/gemini-1.5-pro", api_key="sk-my-key")
    async for _ in engine.chat_stream("hi", history=[]):
        pass

    assert captured["api_key"] == "sk-my-key"


class _NoOpSessionCM:
    """Stands in for `async with worker_session_factory() as session:` in
    tests that mock get_configured_secret directly and never actually
    touch the session it's handed."""

    async def __aenter__(self):
        return None

    async def __aexit__(self, *exc_info: object) -> bool:
        return False


async def test_resolve_api_key_noop_when_already_set(monkeypatch: pytest.MonkeyPatch) -> None:
    called = []

    async def fake_get_configured_secret(*args, **kwargs):
        called.append(True)
        return "should-not-be-used"

    monkeypatch.setattr(litellm_engine_module, "get_configured_secret", fake_get_configured_secret)

    engine = LiteLLMEngine(model="gemini/gemini-1.5-pro", api_key="already-set-key")
    result = await engine._resolve_api_key()

    assert result == "already-set-key"
    assert called == []


async def test_resolve_api_key_noop_for_ollama(monkeypatch: pytest.MonkeyPatch) -> None:
    called = []

    async def fake_get_configured_secret(*args, **kwargs):
        called.append(True)
        return "should-not-be-used"

    monkeypatch.setattr(litellm_engine_module, "get_configured_secret", fake_get_configured_secret)

    engine = LiteLLMEngine(model="ollama/llama3.1")
    result = await engine._resolve_api_key()

    assert result is None
    assert called == []


async def test_resolve_api_key_prefers_configured_secret_over_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_get_configured_secret(session, key, env_fallback):
        assert key == "anthropic_api_key"
        assert env_fallback == "env-fallback-key"
        return "db-stored-key"

    fake_settings = SimpleNamespace(anthropic_api_key="env-fallback-key")
    monkeypatch.setattr(litellm_engine_module, "get_settings", lambda: fake_settings)
    monkeypatch.setattr(litellm_engine_module, "get_configured_secret", fake_get_configured_secret)
    monkeypatch.setattr(litellm_engine_module, "worker_session_factory", lambda: _NoOpSessionCM())

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    result = await engine._resolve_api_key()

    assert result == "db-stored-key"
    assert engine.api_key == "db-stored-key"


async def test_execute_resolves_and_forwards_db_stored_anthropic_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = {}

    async def fake_acompletion(**kwargs):
        captured.update(kwargs)
        return _fake_response()

    async def fake_get_configured_secret(session, key, env_fallback):
        return "resolved-from-settings"

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)
    monkeypatch.setattr(litellm_engine_module.litellm, "completion_cost", lambda r: 0.0)
    monkeypatch.setattr(litellm_engine_module, "get_configured_secret", fake_get_configured_secret)
    monkeypatch.setattr(litellm_engine_module, "worker_session_factory", lambda: _NoOpSessionCM())

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    await engine.execute("hi", context={})

    assert captured["api_key"] == "resolved-from-settings"


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


def _tool_call(call_id: str, name: str, arguments: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=call_id, function=SimpleNamespace(name=name, arguments=arguments)
    )


def _tool_call_response(tool_calls: list, total_tokens: int = 10) -> SimpleNamespace:
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=None, tool_calls=tool_calls))],
        usage=SimpleNamespace(total_tokens=total_tokens),
    )


async def test_execute_runs_tool_loop_and_returns_final_answer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []
    responses = [
        _tool_call_response([_tool_call("call_1", "delegate_to_x", '{"brief": "do it"}')]),
        _fake_response("final answer", total_tokens=5),
    ]

    async def fake_acompletion(**kwargs):
        return responses.pop(0)

    async def tool_executor(name: str, args: dict) -> tuple[str, bool]:
        calls.append((name, args))
        return "delegated result", False

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)
    monkeypatch.setattr(litellm_engine_module.litellm, "completion_cost", lambda r: 0.001)

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    result = await engine.execute(
        "do a thing",
        context={"tools": [{"type": "function", "function": {"name": "delegate_to_x"}}],
                 "tool_executor": tool_executor},
    )

    assert calls == [("delegate_to_x", {"brief": "do it"})]
    assert result.output == "final answer"
    # tokens/cost accumulate across both rounds, not just the final one
    assert result.tokens_used == 15
    assert result.cost_usd == pytest.approx(0.002)


async def test_execute_runs_parallel_tool_calls_concurrently(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two tool_use blocks in one turn must be awaited via asyncio.gather,
    not sequentially — proven by having each call block until it observes
    the other has also started."""
    started: list[str] = []
    both_started = asyncio.Event()

    async def tool_executor(name: str, args: dict) -> tuple[str, bool]:
        started.append(name)
        if len(started) == 2:
            both_started.set()
        else:
            await asyncio.wait_for(both_started.wait(), timeout=1)
        return f"result-{name}", False

    responses = [
        _tool_call_response(
            [_tool_call("c1", "tool_a", "{}"), _tool_call("c2", "tool_b", "{}")]
        ),
        _fake_response("done"),
    ]

    async def fake_acompletion(**kwargs):
        return responses.pop(0)

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)
    monkeypatch.setattr(litellm_engine_module.litellm, "completion_cost", lambda r: 0.0)

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    result = await engine.execute(
        "do two things", context={"tools": [{}], "tool_executor": tool_executor}
    )

    assert set(started) == {"tool_a", "tool_b"}
    assert result.output == "done"


async def test_execute_tool_loop_caps_rounds(monkeypatch: pytest.MonkeyPatch) -> None:
    """A tool_executor that keeps returning tool_calls forever must not
    loop indefinitely — _MAX_TOOL_ROUNDS bounds it."""
    call_count = 0

    async def fake_acompletion(**kwargs):
        nonlocal call_count
        call_count += 1
        return _tool_call_response([_tool_call(f"c{call_count}", "loop_tool", "{}")])

    async def tool_executor(name: str, args: dict) -> tuple[str, bool]:
        return "keep going", False

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)
    monkeypatch.setattr(litellm_engine_module.litellm, "completion_cost", lambda r: 0.0)

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    await engine.execute("loop forever", context={"tools": [{}], "tool_executor": tool_executor})

    assert call_count == litellm_engine_module._MAX_TOOL_ROUNDS


async def test_chat_stream_runs_tool_loop_then_continues_streaming(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def tool_call_stream():
        yield SimpleNamespace(
            choices=[
                SimpleNamespace(
                    delta=SimpleNamespace(
                        content=None,
                        tool_calls=[
                            SimpleNamespace(
                                index=0,
                                id="call_1",
                                function=SimpleNamespace(name="delegate_to_x", arguments=None),
                            )
                        ],
                    )
                )
            ]
        )
        yield SimpleNamespace(
            choices=[
                SimpleNamespace(
                    delta=SimpleNamespace(
                        content=None,
                        tool_calls=[
                            SimpleNamespace(
                                index=0,
                                id=None,
                                function=SimpleNamespace(
                                    name=None, arguments='{"brief": "go"}'
                                ),
                            )
                        ],
                    )
                )
            ]
        )

    async def text_stream():
        for content in ["Al", "right", "!"]:
            yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=content))])

    streams = [tool_call_stream(), text_stream()]

    async def fake_acompletion(**kwargs):
        assert kwargs["stream"] is True
        return streams.pop(0)

    calls = []

    async def tool_executor(name: str, args: dict) -> tuple[str, bool]:
        calls.append((name, args))
        return "delegated output", False

    monkeypatch.setattr(litellm_engine_module.litellm, "acompletion", fake_acompletion)

    engine = LiteLLMEngine(model="claude-sonnet-4-5")
    deltas = [
        d
        async for d in engine.chat_stream(
            "do it", history=[], tools=[{}], tool_executor=tool_executor
        )
    ]

    assert calls == [("delegate_to_x", {"brief": "go"})]
    assert deltas == ["Al", "right", "!"]
