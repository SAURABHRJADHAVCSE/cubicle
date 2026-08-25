"""CLI-subprocess agent engine: wraps the OpenCode CLI (`opencode`).

Genuinely tested against a live install (unlike the other new engines in
this batch — see registry.py for which ones that applies to). Two things
that don't match ClaudeCodeEngine's shape, both confirmed by running the
real CLI rather than assumed from docs:

- `opencode run ... --format json` streams newline-delimited JSON *events*
  (`step_start`, `text`, `step_finish`, ...), not one JSON blob.
- It exits 0 even when the run actually failed (e.g. an unknown model) —
  the traceback goes to stdout/stderr, but the process return code can't
  be trusted to detect failure. Success is instead "did we see at least
  one text event".
"""

import asyncio
import json
import os
import shutil
from collections.abc import AsyncIterator

import structlog

from app.engines.base import AgentEngine, EngineResult

logger = structlog.get_logger()

# opencode/big-pickle is a free model requiring no API key/auth at all —
# confirmed working live, so it's a reasonable zero-config default. Swap
# to any provider/model opencode has credentials for via engine_model.
_DEFAULT_MODEL = "opencode/big-pickle"
_MODEL_CATALOG = ["opencode/big-pickle", "opencode/grok-code", "opencode/kimi-k2.5-free"]


class OpenCodeEngine(AgentEngine):
    """Runs a task by invoking the `opencode` CLI as a subprocess."""

    def __init__(self, model: str | None = None, working_dir: str | None = None) -> None:
        self.model = model or _DEFAULT_MODEL
        self.working_dir = working_dir or "."

    async def execute(self, prompt: str, context: dict) -> EngineResult:
        working_dir = context.get("working_dir") or self.working_dir
        os.makedirs(working_dir, exist_ok=True)

        cmd = ["opencode", "run", prompt, "--format", "json", "-m", self.model]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=working_dir,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        raw_output = stdout.decode(errors="replace")

        text_parts: list[str] = []
        tokens_used = 0
        cost_usd = 0.0
        for line in raw_output.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue  # non-JSON noise on stdout; not every line is an event
            part = event.get("part", {})
            if event.get("type") == "text" and part.get("text"):
                text_parts.append(part["text"])
            elif event.get("type") == "step_finish":
                usage = part.get("tokens", {})
                tokens_used += usage.get("input", 0) + usage.get("output", 0)
                cost_usd += part.get("cost", 0) or 0

        if not text_parts:
            # See module docstring: opencode exits 0 even on failure, so an
            # empty/unparseable event stream is the actual failure signal.
            error = stderr.decode(errors="replace").strip()
            logger.error(
                "opencode_cli_no_output", returncode=process.returncode, stderr=error, stdout=raw_output[-1000:]
            )
            raise RuntimeError(f"opencode CLI produced no output: {error or raw_output[-500:]}")

        return EngineResult(
            output="".join(text_parts),
            raw_output=raw_output,
            tokens_used=tokens_used,
            cost_usd=cost_usd,
        )

    async def chat_stream(self, message: str, history: list[dict]) -> AsyncIterator[str]:
        # Same stateless-per-call approach as ClaudeCodeEngine — opencode
        # does support session continuation (`-c`/`-s <id>`), but that
        # needs a place to persist the session id per agent that doesn't
        # exist yet. Folding history into the prompt is the simpler v1.
        transcript = "\n".join(
            f"{'User' if turn['role'] == 'user' else 'You'}: {turn['content']}"
            for turn in history
        )
        prompt = f"{transcript}\nUser: {message}" if transcript else message

        result = await self.execute(prompt, context={})
        yield result.output

    async def is_available(self) -> bool:
        return shutil.which("opencode") is not None

    def get_models(self) -> list[str]:
        return _MODEL_CATALOG
