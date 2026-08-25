"""Tests for GenericCliEngine, with subprocesses mocked out."""

import asyncio

import pytest

from app.engines import generic_cli as generic_cli_module
from app.engines.generic_cli import GenericCliEngine


class _FakeProcess:
    def __init__(self, returncode: int, stdout: bytes, stderr: bytes = b"") -> None:
        self.returncode = returncode
        self._stdout = stdout
        self._stderr = stderr

    async def communicate(self) -> tuple[bytes, bytes]:
        return self._stdout, self._stderr


@pytest.mark.parametrize(
    ("provider", "expected_prefix"),
    [
        ("codex", ["codex", "exec"]),
        ("grok", ["grok", "-p"]),
        ("gemini", ["gemini", "-p"]),
        ("antigravity", ["gemini", "-p"]),
        ("qwen", ["qwen", "-p"]),
    ],
)
async def test_execute_builds_default_command_per_provider(
    monkeypatch: pytest.MonkeyPatch, tmp_path, provider, expected_prefix
) -> None:
    captured_cmd = {}

    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        captured_cmd["cmd"] = cmd
        return _FakeProcess(returncode=0, stdout=b"ok")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = GenericCliEngine(provider=provider, working_dir=str(tmp_path))
    result = await engine.execute("say hi", context={})

    assert result.output == "ok"
    assert list(captured_cmd["cmd"][: len(expected_prefix)]) == expected_prefix
    assert captured_cmd["cmd"][-1] == "say hi"


async def test_execute_includes_model_flag_when_set(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    captured_cmd = {}

    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        captured_cmd["cmd"] = cmd
        return _FakeProcess(returncode=0, stdout=b"ok")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = GenericCliEngine(provider="codex", model="o4-mini", working_dir=str(tmp_path))
    await engine.execute("say hi", context={})

    assert "-m" in captured_cmd["cmd"]
    assert "o4-mini" in captured_cmd["cmd"]


async def test_execute_uses_command_override_with_prompt_templating(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    captured_cmd = {}

    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        captured_cmd["cmd"] = cmd
        return _FakeProcess(returncode=0, stdout=b"ok")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = GenericCliEngine(
        provider="codex",
        command="codex exec --sandbox read-only {prompt}",
        working_dir=str(tmp_path),
    )
    await engine.execute("say hi", context={})

    assert list(captured_cmd["cmd"]) == ["codex", "exec", "--sandbox", "read-only", "say hi"]


async def test_execute_raises_on_nonzero_exit(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        return _FakeProcess(returncode=1, stdout=b"", stderr=b"boom")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = GenericCliEngine(provider="codex", working_dir=str(tmp_path))
    with pytest.raises(RuntimeError, match="boom"):
        await engine.execute("say hi", context={})


async def test_execute_raises_on_empty_output(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        return _FakeProcess(returncode=0, stdout=b"")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = GenericCliEngine(provider="codex", working_dir=str(tmp_path))
    with pytest.raises(RuntimeError, match="no output"):
        await engine.execute("say hi", context={})


async def test_execute_unknown_provider_without_override_raises(tmp_path) -> None:
    engine = GenericCliEngine(provider="mystery", working_dir=str(tmp_path))
    with pytest.raises(ValueError, match="No default command known"):
        await engine.execute("say hi", context={})


async def test_execute_falls_back_to_engine_working_dir_when_context_value_is_none(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    captured_cwd = {}

    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        captured_cwd["cwd"] = cwd
        return _FakeProcess(returncode=0, stdout=b"ok")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = GenericCliEngine(provider="codex", working_dir=str(tmp_path))
    await engine.execute("say hi", context={"working_dir": None})

    assert captured_cwd["cwd"] == str(tmp_path)


async def test_chat_stream_yields_full_reply_once(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    async def fake_create_subprocess_exec(*cmd, cwd, stdin, stdout, stderr):
        return _FakeProcess(returncode=0, stdout=b"hi there")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = GenericCliEngine(provider="codex", working_dir=str(tmp_path))
    history = [{"role": "user", "content": "hello"}, {"role": "agent", "content": "hi!"}]
    deltas = [d async for d in engine.chat_stream("how are you?", history)]

    assert deltas == ["hi there"]


async def test_is_available_checks_provider_binary(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(generic_cli_module.shutil, "which", lambda name: "/usr/bin/codex" if name == "codex" else None)

    assert await GenericCliEngine(provider="codex").is_available() is True
    assert await GenericCliEngine(provider="grok").is_available() is False


async def test_is_available_checks_override_command_binary(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(generic_cli_module.shutil, "which", lambda name: "/usr/bin/foo" if name == "foo" else None)

    engine = GenericCliEngine(provider="mystery", command="foo run {prompt}")
    assert await engine.is_available() is True


def test_get_models_returns_empty_catalog() -> None:
    assert GenericCliEngine(provider="codex").get_models() == []
