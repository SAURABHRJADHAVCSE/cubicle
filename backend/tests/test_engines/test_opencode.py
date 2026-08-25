"""Tests for OpenCodeEngine, with the `opencode` subprocess mocked out."""

import asyncio
import json

import pytest

from app.engines import opencode as opencode_module
from app.engines.opencode import OpenCodeEngine


class _FakeProcess:
    def __init__(self, returncode: int, stdout: bytes, stderr: bytes = b"") -> None:
        self.returncode = returncode
        self._stdout = stdout
        self._stderr = stderr

    async def communicate(self) -> tuple[bytes, bytes]:
        return self._stdout, self._stderr


def _ndjson(*events: dict) -> bytes:
    return ("\n".join(json.dumps(e) for e in events)).encode()


async def test_execute_parses_ndjson_text_events(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        assert "opencode" in cmd
        assert "run" in cmd
        return _FakeProcess(
            returncode=0,
            stdout=_ndjson(
                {"type": "step_start", "part": {}},
                {"type": "text", "part": {"text": "hello "}},
                {"type": "text", "part": {"text": "world"}},
                {"type": "step_finish", "part": {"tokens": {"input": 10, "output": 4}, "cost": 0.001}},
            ),
        )

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = OpenCodeEngine(working_dir=str(tmp_path))
    result = await engine.execute("say hi", context={})

    assert result.output == "hello world"
    assert result.tokens_used == 14
    assert result.cost_usd == 0.001


async def test_execute_raises_when_no_text_events_even_on_exit_zero(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    # opencode exits 0 even on a failed run (e.g. unknown model) — the
    # absence of any text event is the real failure signal, not returncode.
    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        return _FakeProcess(returncode=0, stdout=b"", stderr=b"unknown model")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = OpenCodeEngine(working_dir=str(tmp_path))
    with pytest.raises(RuntimeError, match="unknown model"):
        await engine.execute("say hi", context={})


async def test_execute_ignores_non_json_lines(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        return _FakeProcess(
            returncode=0,
            stdout=b"some noise line\n" + _ndjson({"type": "text", "part": {"text": "ok"}}),
        )

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = OpenCodeEngine(working_dir=str(tmp_path))
    result = await engine.execute("say hi", context={})

    assert result.output == "ok"


async def test_execute_falls_back_to_engine_working_dir_when_context_value_is_none(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    captured_cwd = {}

    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        captured_cwd["cwd"] = cwd
        return _FakeProcess(returncode=0, stdout=_ndjson({"type": "text", "part": {"text": "ok"}}))

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = OpenCodeEngine(working_dir=str(tmp_path))
    await engine.execute("say hi", context={"working_dir": None})

    assert captured_cwd["cwd"] == str(tmp_path)


async def test_execute_uses_configured_model(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    captured_cmd = {}

    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        captured_cmd["cmd"] = cmd
        return _FakeProcess(returncode=0, stdout=_ndjson({"type": "text", "part": {"text": "ok"}}))

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = OpenCodeEngine(model="opencode/grok-code", working_dir=str(tmp_path))
    await engine.execute("say hi", context={})

    assert "opencode/grok-code" in captured_cmd["cmd"]


async def test_chat_stream_yields_full_reply_once(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        return _FakeProcess(returncode=0, stdout=_ndjson({"type": "text", "part": {"text": "hi there"}}))

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = OpenCodeEngine(working_dir=str(tmp_path))
    history = [{"role": "user", "content": "hello"}, {"role": "agent", "content": "hi!"}]
    deltas = [d async for d in engine.chat_stream("how are you?", history)]

    assert deltas == ["hi there"]


async def test_is_available_checks_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(opencode_module.shutil, "which", lambda name: "/usr/bin/opencode")
    assert await OpenCodeEngine().is_available() is True

    monkeypatch.setattr(opencode_module.shutil, "which", lambda name: None)
    assert await OpenCodeEngine().is_available() is False


def test_get_models_returns_catalog() -> None:
    assert "opencode/big-pickle" in OpenCodeEngine().get_models()
