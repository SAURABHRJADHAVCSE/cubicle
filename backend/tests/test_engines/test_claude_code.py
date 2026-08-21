"""Tests for ClaudeCodeEngine, with the `claude` subprocess mocked out."""

import asyncio
import json

import pytest

from app.engines import claude_code as claude_code_module
from app.engines.claude_code import ClaudeCodeEngine


class _FakeProcess:
    def __init__(self, returncode: int, stdout: bytes, stderr: bytes = b"") -> None:
        self.returncode = returncode
        self._stdout = stdout
        self._stderr = stderr

    async def communicate(self) -> tuple[bytes, bytes]:
        return self._stdout, self._stderr


async def test_execute_parses_cli_json_output(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    # Real `claude --output-format json` output has input_tokens/output_tokens,
    # not a total_tokens field — execute() must sum them itself.
    payload = json.dumps(
        {
            "result": "done!",
            "usage": {"input_tokens": 5, "output_tokens": 2},
            "total_cost_usd": 0.02,
        }
    )

    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr):
        assert "claude" in cmd
        assert "-p" in cmd
        return _FakeProcess(returncode=0, stdout=payload.encode())

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    result = await engine.execute("say hi", context={})

    assert result.output == "done!"
    assert result.tokens_used == 7
    assert result.cost_usd == 0.02


async def test_execute_prefers_total_tokens_when_present(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    payload = json.dumps({"result": "done!", "usage": {"total_tokens": 99}})

    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr):
        return _FakeProcess(returncode=0, stdout=payload.encode())

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    result = await engine.execute("say hi", context={})

    assert result.tokens_used == 99


async def test_execute_raises_on_nonzero_exit(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr):
        return _FakeProcess(returncode=1, stdout=b"", stderr=b"auth error")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    with pytest.raises(RuntimeError, match="auth error"):
        await engine.execute("say hi", context={})


async def test_execute_raises_on_invalid_json(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr):
        return _FakeProcess(returncode=0, stdout=b"not json")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    with pytest.raises(RuntimeError, match="non-JSON"):
        await engine.execute("say hi", context={})


async def test_is_available_checks_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(claude_code_module.shutil, "which", lambda name: "/usr/bin/claude")
    assert await ClaudeCodeEngine().is_available() is True

    monkeypatch.setattr(claude_code_module.shutil, "which", lambda name: None)
    assert await ClaudeCodeEngine().is_available() is False
