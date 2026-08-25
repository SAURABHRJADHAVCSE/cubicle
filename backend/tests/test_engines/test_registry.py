"""Tests for engine registry dispatch logic."""

import pytest

from app.engines.claude_code import ClaudeCodeEngine
from app.engines.generic_cli import GenericCliEngine
from app.engines.litellm_engine import LiteLLMEngine
from app.engines.opencode import OpenCodeEngine
from app.engines.registry import get_engine
from app.models.agent import Agent


def _agent(**overrides) -> Agent:
    defaults = dict(
        name="Test",
        role="Tester",
        engine_type="api",
        engine_provider="anthropic",
        personality_traits=[],
    )
    return Agent(**{**defaults, **overrides})


def test_get_engine_claude_code_cli() -> None:
    agent = _agent(engine_type="cli", engine_provider="claude_code", engine_model="claude-sonnet-4-5")
    engine = get_engine(agent)

    assert isinstance(engine, ClaudeCodeEngine)
    assert engine.model == "claude-sonnet-4-5"


def test_get_engine_anthropic_api_defaults_model() -> None:
    agent = _agent(engine_type="api", engine_provider="anthropic")
    engine = get_engine(agent)

    assert isinstance(engine, LiteLLMEngine)
    assert engine.model == "claude-sonnet-4-5"


def test_get_engine_ollama_prefixes_model() -> None:
    agent = _agent(engine_type="api", engine_provider="ollama", engine_model="llama3.1")
    engine = get_engine(agent)

    assert isinstance(engine, LiteLLMEngine)
    assert engine.model == "ollama/llama3.1"


def test_get_engine_opencode_cli() -> None:
    agent = _agent(engine_type="cli", engine_provider="opencode", engine_model="opencode/big-pickle")
    engine = get_engine(agent)

    assert isinstance(engine, OpenCodeEngine)
    assert engine.model == "opencode/big-pickle"


@pytest.mark.parametrize("provider", ["codex", "grok", "gemini", "antigravity", "qwen"])
def test_get_engine_generic_cli_providers(provider: str) -> None:
    agent = _agent(engine_type="cli", engine_provider=provider, engine_command="foo {prompt}")
    engine = get_engine(agent)

    assert isinstance(engine, GenericCliEngine)
    assert engine.provider == provider
    assert engine.command == "foo {prompt}"


def test_get_engine_unsupported_cli_provider_raises() -> None:
    agent = _agent(engine_type="cli", engine_provider="mystery")

    with pytest.raises(ValueError, match="Unsupported CLI engine provider"):
        get_engine(agent)


def test_get_engine_unsupported_provider_raises() -> None:
    agent = _agent(engine_type="api", engine_provider="grok")

    with pytest.raises(ValueError, match="Unsupported API engine provider"):
        get_engine(agent)


def test_get_engine_unsupported_type_raises() -> None:
    agent = _agent(engine_type="voice")

    with pytest.raises(ValueError, match="Unsupported engine_type"):
        get_engine(agent)
