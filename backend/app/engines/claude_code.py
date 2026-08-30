"""CLI-subprocess agent engine: wraps the Claude Code CLI (`claude`)."""

import asyncio
import json
import os
import shutil
from collections.abc import AsyncIterator

import structlog

from app.config import get_settings
from app.database import worker_session_factory
from app.engines.base import AgentEngine, EngineResult, ToolExecutor
from app.utils.secrets_store import CLAUDE_OAUTH_TOKEN_KEY, get_encrypted_setting

logger = structlog.get_logger()

_MODEL_CATALOG = ["claude-opus-4-6", "claude-sonnet-4-5", "claude-haiku-4-5"]


async def _get_stored_oauth_token() -> str | None:
    """Look up the Claude Code OAuth token connected via Settings.

    Uses the NullPool-backed worker_session_factory rather than the
    FastAPI-facing pooled one — this engine runs from both the API process
    and Celery task bodies, and a pooled asyncpg connection checked out in
    one and reused from the other's separate event loop breaks (see
    app/database.py's docstring on that exact failure mode). NullPool has
    nothing to go stale.
    """
    async with worker_session_factory() as session:
        return await get_encrypted_setting(session, CLAUDE_OAUTH_TOKEN_KEY)


class ClaudeCodeEngine(AgentEngine):
    """Runs a task by invoking the `claude` CLI as a subprocess.

    Requires the `claude` binary on PATH, and a Claude Code OAuth token
    connected via Settings → Claude Code CLI (stored encrypted in the
    `settings` table, injected here as CLAUDE_CODE_OAUTH_TOKEN). Deliberately
    also strips ``ANTHROPIC_API_KEY`` from the subprocess's environment: if
    it's present, the CLI authenticates via pay-per-token API billing
    instead of the connected subscription. This project's Anthropic *API*
    engine (LiteLLMEngine) still uses that key directly — only the `claude`
    subprocess doesn't see it.
    """

    def __init__(
        self,
        model: str | None = None,
        allowed_tools: list[str] | None = None,
        working_dir: str | None = None,
    ) -> None:
        self.model = model
        self.allowed_tools = allowed_tools or []
        self.working_dir = working_dir or "."

    async def execute(self, prompt: str, context: dict) -> EngineResult:
        # `or`, not `context.get("working_dir", self.working_dir)`: the
        # caller (task_worker.py) always sets this key, even when the
        # agent's working_directory column is None — dict.get()'s default
        # only kicks in when a key is *absent*, not when it's present with
        # a None value, so that lookup was silently passing None through to
        # os.makedirs() whenever an agent had no working directory set.
        working_dir = context.get("working_dir") or self.working_dir
        os.makedirs(working_dir, exist_ok=True)

        # `--print` mode has no TTY behind it (stdout/stderr are piped, no
        # stdin hooked up) — there's no one to answer an interactive
        # permission prompt, so without this flag the CLI just reports back
        # "blocked by permissions" instead of writing, on every file
        # write/edit/bash call an agent makes. Safe to default on here since
        # each agent is already confined to its own working_dir below.
        cmd = ["claude", "--print", "--output-format", "json", "--dangerously-skip-permissions"]
        if self.allowed_tools:
            cmd += ["--allowedTools", ",".join(self.allowed_tools)]
        if self.model:
            cmd += ["--model", self.model]
        cmd += ["-p", prompt]

        # See class docstring: ANTHROPIC_API_KEY is intentionally excluded
        # so the CLI falls back to the connected subscription token instead
        # of switching to API-key billing.
        subprocess_env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
        oauth_token = await _get_stored_oauth_token()
        if oauth_token:
            subprocess_env["CLAUDE_CODE_OAUTH_TOKEN"] = oauth_token

        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=working_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=subprocess_env,
        )
        timeout = get_settings().task_timeout_seconds
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
        except TimeoutError:
            # communicate() timing out leaves the process running — kill it
            # and reap it (kill() alone leaves a zombie) before surfacing the
            # error, or a hung CLI process outlives the task that spawned it.
            process.kill()
            await process.wait()
            logger.error("claude_code_cli_timeout", timeout_seconds=timeout)
            raise RuntimeError(f"claude CLI timed out after {timeout}s") from None

        if process.returncode != 0:
            error = stderr.decode(errors="replace").strip()
            logger.error("claude_code_cli_failed", returncode=process.returncode, error=error)
            raise RuntimeError(f"claude CLI exited {process.returncode}: {error}")

        try:
            result = json.loads(stdout.decode())
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"claude CLI returned non-JSON output: {exc}") from exc

        usage = result.get("usage", {})
        # The CLI's JSON reports separate input_tokens/output_tokens, not a
        # total_tokens field — sum the two actually-billed-as-content fields
        # (cache reads/writes are accounted for separately in total_cost_usd).
        tokens_used = usage.get("total_tokens") or (
            usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
        )

        return EngineResult(
            output=result.get("result", ""),
            raw_output=stdout.decode(),
            tokens_used=tokens_used,
            cost_usd=result.get("total_cost_usd", 0.0),
        )

    async def chat_stream(
        self,
        message: str,
        history: list[dict],
        tools: list[dict] | None = None,
        tool_executor: ToolExecutor | None = None,
    ) -> AsyncIterator[str]:
        # Accepts tools/tool_executor for signature parity with AgentEngine
        # but ignores them — the CLI has no structured tool-calling protocol
        # Cubicle can drive (see base.py's chat_stream docstring).
        # `--print` is a stateless, single-shot invocation with no native
        # session resumption wired up yet, so recent turns are folded into
        # the prompt text itself to give the CLI some conversational context.
        transcript = "\n".join(
            f"{'User' if turn['role'] == 'user' else 'You'}: {turn['content']}"
            for turn in history
        )
        prompt = f"{transcript}\nUser: {message}" if transcript else message

        result = await self.execute(prompt, context={})
        yield result.output

    async def is_available(self) -> bool:
        return shutil.which("claude") is not None

    def get_models(self) -> list[str]:
        return _MODEL_CATALOG
