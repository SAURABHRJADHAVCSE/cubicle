"""Tests for ClaudeCodeEngine, with the `claude` subprocess mocked out."""

import asyncio
import json
from types import SimpleNamespace

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


class _HangingProcess:
    """Simulates a CLI process whose communicate() never returns, so
    execute()'s asyncio.wait_for() is what actually has to end the test."""

    def __init__(self) -> None:
        self.killed = False
        self.waited = False

    async def communicate(self) -> tuple[bytes, bytes]:
        await asyncio.sleep(999)
        raise AssertionError("should have been cancelled by wait_for's timeout")

    def kill(self) -> None:
        self.killed = True

    async def wait(self) -> None:
        self.waited = True


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

    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr, env=None):
        assert "claude" in cmd
        assert "-p" in cmd
        return _FakeProcess(returncode=0, stdout=payload.encode())

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    result = await engine.execute("say hi", context={})

    assert result.output == "done!"
    assert result.tokens_used == 7
    assert result.cost_usd == 0.02


async def test_execute_falls_back_to_engine_working_dir_when_context_value_is_none(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    # Regression: task_worker.py always sets context["working_dir"], even
    # to None when an agent has no working_directory configured. dict.get()
    # with a default only falls back when the key is *absent*, not when
    # it's present-but-None, so this used to reach os.makedirs(None, ...)
    # and blow up with "expected str, bytes or os.PathLike object, not
    # NoneType" — exactly reproduced here via the same context shape.
    payload = json.dumps({"result": "done!"})
    captured_cwd = {}

    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr, env=None):
        captured_cwd["cwd"] = cwd
        return _FakeProcess(returncode=0, stdout=payload.encode())

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    result = await engine.execute("say hi", context={"working_dir": None})

    assert result.output == "done!"
    assert captured_cwd["cwd"] == str(tmp_path)


async def test_execute_prefers_total_tokens_when_present(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    payload = json.dumps({"result": "done!", "usage": {"total_tokens": 99}})

    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr, env=None):
        return _FakeProcess(returncode=0, stdout=payload.encode())

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    result = await engine.execute("say hi", context={})

    assert result.tokens_used == 99


async def test_execute_raises_on_nonzero_exit(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr, env=None):
        return _FakeProcess(returncode=1, stdout=b"", stderr=b"auth error")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    with pytest.raises(RuntimeError, match="auth error"):
        await engine.execute("say hi", context={})


async def test_execute_raises_on_invalid_json(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr, env=None):
        return _FakeProcess(returncode=0, stdout=b"not json")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    with pytest.raises(RuntimeError, match="non-JSON"):
        await engine.execute("say hi", context={})


async def test_chat_stream_yields_full_reply_once(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    payload = json.dumps({"result": "hi there"})
    captured_prompt = {}

    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr, env=None):
        captured_prompt["prompt"] = cmd[cmd.index("-p") + 1]
        return _FakeProcess(returncode=0, stdout=payload.encode())

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    history = [{"role": "user", "content": "hello"}, {"role": "agent", "content": "hi!"}]
    deltas = [d async for d in engine.chat_stream("how are you?", history)]

    assert deltas == ["hi there"]
    assert "User: hello" in captured_prompt["prompt"]
    assert "You: hi!" in captured_prompt["prompt"]
    assert captured_prompt["prompt"].endswith("User: how are you?")


async def test_execute_strips_anthropic_api_key_from_subprocess_env(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-should-not-reach-cli")
    payload = json.dumps({"result": "ok"})
    captured_env = {}

    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr, env=None):
        captured_env.update(env or {})
        return _FakeProcess(returncode=0, stdout=payload.encode())

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    await engine.execute("say hi", context={})

    assert "ANTHROPIC_API_KEY" not in captured_env


async def test_execute_kills_process_on_timeout(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    fake_settings = SimpleNamespace(task_timeout_seconds=0.05)
    monkeypatch.setattr(claude_code_module, "get_settings", lambda: fake_settings)

    hanging = _HangingProcess()

    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr, env=None):
        return hanging

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    with pytest.raises(RuntimeError, match="timed out"):
        await engine.execute("say hi", context={})

    assert hanging.killed is True
    assert hanging.waited is True


async def test_execute_appends_system_prompt_when_given(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    """Regression coverage for a real gap: context["system_prompt"] (agent
    identity, SOUL.md, honesty guardrails — see task_worker.py) was built
    but never actually reached this engine at all, only the raw task brief
    did via -p. --append-system-prompt is a real, `claude --help`-confirmed
    flag for this."""
    payload = json.dumps({"result": "done!"})
    captured_cmd = {}

    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr, env=None):
        captured_cmd["cmd"] = cmd
        return _FakeProcess(returncode=0, stdout=payload.encode())

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    await engine.execute("say hi", context={"system_prompt": "You are Jarvis, a Developer."})

    cmd = captured_cmd["cmd"]
    assert "--append-system-prompt" in cmd
    assert cmd[cmd.index("--append-system-prompt") + 1] == "You are Jarvis, a Developer."


async def test_execute_omits_append_system_prompt_when_blank(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    payload = json.dumps({"result": "done!"})
    captured_cmd = {}

    async def fake_create_subprocess_exec(*cmd, cwd, stdout, stderr, env=None):
        captured_cmd["cmd"] = cmd
        return _FakeProcess(returncode=0, stdout=payload.encode())

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    engine = ClaudeCodeEngine(working_dir=str(tmp_path))
    await engine.execute("say hi", context={"system_prompt": ""})
    await engine.execute("say hi", context={})

    assert "--append-system-prompt" not in captured_cmd["cmd"]


async def test_is_available_checks_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(claude_code_module.shutil, "which", lambda name: "/usr/bin/claude")
    assert await ClaudeCodeEngine().is_available() is True

    monkeypatch.setattr(claude_code_module.shutil, "which", lambda name: None)
    assert await ClaudeCodeEngine().is_available() is False
