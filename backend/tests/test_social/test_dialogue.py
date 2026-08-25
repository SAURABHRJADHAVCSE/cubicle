"""Tests for app.social.dialogue.generate_dialogue — the LLM call is
mocked, so these are fast and don't require a running Ollama."""

import uuid

import pytest

from app.engines.base import EngineResult
from app.models.agent import Agent
from app.social import dialogue as dialogue_module


def _agent(**overrides) -> Agent:
    defaults = dict(
        id=uuid.uuid4(),
        name="Priya",
        role="Recruiter",
        engine_type="api",
        engine_provider="anthropic",
        personality_traits=["extrovert", "playful"],
    )
    return Agent(**{**defaults, **overrides})


class _StubEngine:
    def __init__(self, output: str | None = None, error: Exception | None = None) -> None:
        self._output = output
        self._error = error

    async def execute(self, prompt: str, context: dict) -> EngineResult:
        if self._error:
            raise self._error
        return EngineResult(output=self._output)


async def test_generate_dialogue_returns_llm_line(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        dialogue_module,
        "LiteLLMEngine",
        lambda model, api_base=None: _StubEngine(output=' "Back at it, let\'s go!" '),
    )

    line = await dialogue_module.generate_dialogue(_agent(), "starting a task", "On it!")

    assert line == "Back at it, let's go!"


async def test_generate_dialogue_falls_back_on_empty_output(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        dialogue_module, "LiteLLMEngine", lambda model, api_base=None: _StubEngine(output="")
    )

    line = await dialogue_module.generate_dialogue(_agent(), "starting a task", "On it!")

    assert line == "On it!"


async def test_generate_dialogue_falls_back_on_llm_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        dialogue_module,
        "LiteLLMEngine",
        lambda model, api_base=None: _StubEngine(error=RuntimeError("ollama unreachable")),
    )

    line = await dialogue_module.generate_dialogue(_agent(), "starting a task", "On it!")

    assert line == "On it!"
