"""CLI-subprocess agent engine: wraps the Claude Code CLI (`claude`)."""

import asyncio
import json
import os
import shutil
from collections.abc import AsyncIterator

import structlog

from app.engines.base import AgentEngine, EngineResult

logger = structlog.get_logger()

_MODEL_CATALOG = ["claude-opus-4-6", "claude-sonnet-4-5", "claude-haiku-4-5"]


class ClaudeCodeEngine(AgentEngine):
    """Runs a task by invoking the `claude` CLI as a subprocess.

    Requires the `claude` binary on PATH. Deliberately strips
    ``ANTHROPIC_API_KEY`` from the subprocess's environment: if it's
    present, the CLI authenticates via pay-per-token API billing instead of
    a Claude subscription. This project's Anthropic *API* engine
    (LiteLLMEngine) still uses that key directly — only the `claude`
    subprocess doesn't see it. For this engine to work at all, the
    container needs a stored subscription session — run once per
    deployment: `docker compose exec -it cubicle-api claude setup-token`
    (persisted via the claude-cli-home volume, shared with cubicle-worker).
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
        working_dir = context.get("working_dir", self.working_dir)
        os.makedirs(working_dir, exist_ok=True)

        cmd = ["claude", "--print", "--output-format", "json"]
        if self.allowed_tools:
            cmd += ["--allowedTools", ",".join(self.allowed_tools)]
        if self.model:
            cmd += ["--model", self.model]
        cmd += ["-p", prompt]

        # See class docstring: ANTHROPIC_API_KEY is intentionally excluded
        # so the CLI falls back to its stored subscription session instead
        # of switching to API-key billing.
        subprocess_env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}

        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=working_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=subprocess_env,
        )
        stdout, stderr = await process.communicate()

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

    async def chat_stream(self, message: str, history: list[dict]) -> AsyncIterator[str]:
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
