"""CLI-subprocess agent engine: runs any CLI coding agent via a configurable
command template.

Backs Codex, Grok, and Gemini/Antigravity (Qwen too — see NOTE below), none
of which are installed on this deployment, so none of these could be
verified against a real run the way Claude Code and OpenCode were. The
per-provider defaults below are sourced from each project's own current
public docs (checked 2026-08), not guessed from memory:

- Codex:  `codex exec "<prompt>"` — non-interactive mode; streams progress
  to stderr, writes only the final message to stdout.
  https://developers.openai.com/codex/noninteractive
- Grok:   `grok -p "<prompt>"` — xAI's "Grok Build" CLI reference.
  https://docs.x.ai/build/cli/reference
- Gemini: `gemini -p "<prompt>"` — headless mode. Documented limitation:
  this mode can't authorize tools (including file writes) or run shell
  commands, so a Gemini-engine agent is effectively read-only/answer-only
  right now, not a file-editing agent.
  https://google-gemini.github.io/gemini-cli/docs/cli/headless.html

NOTE on Qwen: qwen-code is a Gemini CLI fork and documents the same
`-p`/`--prompt` flag, so it's included in the same default-args table
below — but it has no dedicated PROVIDER_BINARIES entry of its own reason
to diverge from "gemini"'s shape, it's just a different binary name.
https://github.com/QwenLM/qwen-code

Structured JSON output exists for some of these (Gemini's --output-format
json, Qwen's --output-format json) but exact field names weren't
confirmed against a live run, so this engine deliberately treats stdout
as plain text rather than risk silently misparsing a guessed schema.
tokens_used/cost_usd stay 0 until someone verifies the real shape with
the actual CLI installed.

If a provider's actual flags differ from the defaults here, override them
per-agent via the `engine_command` field (a shell-style template with
`{prompt}` as the substitution point, e.g. `codex exec --sandbox
read-only {prompt}`).
"""

import asyncio
import os
import shlex
import shutil
from collections.abc import AsyncIterator

import structlog

from app.engines.base import AgentEngine, EngineResult

logger = structlog.get_logger()

PROVIDER_BINARIES: dict[str, str] = {
    "codex": "codex",
    "grok": "grok",
    "gemini": "gemini",
    "antigravity": "gemini",
    "qwen": "qwen",
}
PROVIDER_ARGS: dict[str, list[str]] = {
    "codex": ["exec"],  # prompt is a bare positional, no flag
    "grok": ["-p"],  # prompt is -p's argument
    "gemini": ["-p"],
    "antigravity": ["-p"],
    "qwen": ["-p"],
}


class GenericCliEngine(AgentEngine):
    """Runs a task via any CLI agent's one-shot non-interactive mode."""

    def __init__(
        self,
        provider: str,
        model: str | None = None,
        command: str | None = None,
        working_dir: str | None = None,
    ) -> None:
        self.provider = provider
        self.model = model
        self.command = command  # overrides the provider default entirely, if set
        self.working_dir = working_dir or "."

    def _build_command(self, prompt: str) -> list[str]:
        if self.command:
            return [
                prompt if part == "{prompt}" else part
                for part in shlex.split(self.command)
            ]

        binary = PROVIDER_BINARIES.get(self.provider)
        if not binary:
            raise ValueError(
                f"No default command known for provider {self.provider!r} — "
                "set the agent's engine_command"
            )
        cmd = [binary, *PROVIDER_ARGS.get(self.provider, [])]
        if self.model:
            cmd += ["-m", self.model]
        cmd.append(prompt)
        return cmd

    async def execute(self, prompt: str, context: dict) -> EngineResult:
        working_dir = context.get("working_dir") or self.working_dir
        os.makedirs(working_dir, exist_ok=True)

        cmd = self._build_command(prompt)

        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=working_dir,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        output = stdout.decode(errors="replace").strip()

        if process.returncode != 0:
            error = stderr.decode(errors="replace").strip()
            logger.error(
                "generic_cli_failed",
                provider=self.provider,
                cmd=cmd[0],
                returncode=process.returncode,
                error=error,
            )
            raise RuntimeError(f"{cmd[0]} exited {process.returncode}: {error or output}")

        if not output:
            error = stderr.decode(errors="replace").strip()
            raise RuntimeError(f"{cmd[0]} produced no output" + (f": {error}" if error else ""))

        return EngineResult(output=output, raw_output=stdout.decode(errors="replace"))

    async def chat_stream(self, message: str, history: list[dict]) -> AsyncIterator[str]:
        transcript = "\n".join(
            f"{'User' if turn['role'] == 'user' else 'You'}: {turn['content']}"
            for turn in history
        )
        prompt = f"{transcript}\nUser: {message}" if transcript else message
        result = await self.execute(prompt, context={})
        yield result.output

    async def is_available(self) -> bool:
        if self.command:
            return shutil.which(shlex.split(self.command)[0]) is not None
        binary = PROVIDER_BINARIES.get(self.provider)
        return bool(binary and shutil.which(binary))

    def get_models(self) -> list[str]:
        return []  # unverified — no confident catalog to offer yet
