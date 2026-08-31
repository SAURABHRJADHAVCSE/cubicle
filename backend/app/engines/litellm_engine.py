"""API-based agent engine: direct LLM calls via LiteLLM (Ollama, Anthropic, ...)."""

import asyncio
import json
from collections.abc import AsyncIterator

import litellm
import structlog

from app.config import get_settings
from app.database import worker_session_factory
from app.engines.base import AgentEngine, EngineResult, ToolExecutor
from app.utils.engine_detect import check_ollama
from app.utils.secrets_store import ANTHROPIC_API_KEY_SETTING, get_configured_secret

logger = structlog.get_logger()

_OLLAMA_CATALOG = ["llama3.2", "llama3.1", "qwen2.5", "mistral"]
_ANTHROPIC_CATALOG = ["claude-opus-4-6", "claude-sonnet-4-5", "claude-haiku-4-5"]

# Caps how many tool-call round trips a single turn can make (call the
# model, run tools, call the model again, ...) — independent of the
# cross-agent delegation-depth guard in workers/task_worker.py, which caps
# how deep an A-calls-B-calls-C chain may recurse, not how many rounds one
# agent's own turn takes.
_MAX_TOOL_ROUNDS = 8


class LiteLLMEngine(AgentEngine):
    """Runs a task or chat turn through LiteLLM against Ollama or Anthropic.

    ``model`` follows LiteLLM's provider-prefixed naming (e.g.
    ``"ollama/llama3.2"``, ``"gemini/gemini-1.5-pro"``); a bare model name
    (e.g. ``"claude-sonnet-4-5"``) is routed to Anthropic. Credentials for
    the built-in Ollama/Anthropic providers are read by LiteLLM from the
    process environment — never passed explicitly. ``api_key`` is only for
    a bring-your-own custom provider (see engines/registry.py), passed
    through to every LiteLLM call instead.
    """

    def __init__(self, model: str, api_base: str | None = None, api_key: str | None = None) -> None:
        self.model = model
        self.api_base = api_base
        self.api_key = api_key

    def _extra_call_kwargs(self) -> dict:
        # Conditional, not `api_key=self.api_key` unconditionally: keeps
        # the exact existing request shape for ollama (which never sets
        # this) while covering both a per-agent BYO key and a resolved
        # global Anthropic key (see _resolve_api_key) with the same branch.
        return {"api_key": self.api_key} if self.api_key else {}

    async def _resolve_api_key(self) -> str | None:
        """Fills in self.api_key from Settings → Engine Providers (DB,
        encrypted) when nothing's set yet, falling back to the
        ANTHROPIC_API_KEY env var — same lazy-resolve-inside-the-async-
        method pattern engines/claude_code.py already uses for its own
        stored OAuth token (own worker_session_factory() session, safe
        from both the API process and Celery workers). A no-op once
        self.api_key is already set (a per-agent BYO key resolved
        synchronously in engines/registry.py) or for ollama, which never
        needs a key at all.
        """
        if self.api_key or self.model.startswith("ollama/"):
            return self.api_key
        async with worker_session_factory() as session:
            self.api_key = await get_configured_secret(
                session, ANTHROPIC_API_KEY_SETTING, get_settings().anthropic_api_key
            )
        return self.api_key

    async def execute(self, prompt: str, context: dict) -> EngineResult:
        # Not applied to chat_stream(): that's interactive chat, where a
        # human is already watching the connection and can just close it.
        await self._resolve_api_key()
        timeout = get_settings().task_timeout_seconds
        tools = context.get("tools")
        tool_executor: ToolExecutor | None = context.get("tool_executor")
        messages = [
            {"role": "system", "content": context.get("system_prompt", "")},
            {"role": "user", "content": prompt},
        ]
        try:
            response, tokens_used, cost_usd = await asyncio.wait_for(
                self._run_tool_loop(messages, tools, tool_executor), timeout=timeout
            )
        except TimeoutError:
            logger.error("litellm_call_timeout", model=self.model, timeout_seconds=timeout)
            raise RuntimeError(f"LLM call timed out after {timeout}s") from None
        return self._to_result(response, tokens_used=tokens_used, cost_usd=cost_usd)

    async def _run_tool_loop(
        self, messages: list[dict], tools: list[dict] | None, tool_executor: ToolExecutor | None
    ):
        """Drive the request/tool-call/result cycle to completion (or until
        _MAX_TOOL_ROUNDS is hit, whichever comes first) and return the final
        response plus tokens/cost accumulated across every round — not just
        the last one, since a multi-round turn genuinely spent all of it."""
        total_tokens = 0
        total_cost = 0.0
        response = None
        for _ in range(_MAX_TOOL_ROUNDS):
            response = await litellm.acompletion(
                model=self.model,
                messages=messages,
                api_base=self.api_base,
                tools=tools or None,
                **self._extra_call_kwargs(),
            )
            total_tokens += response.usage.total_tokens if response.usage else 0
            total_cost += self._safe_completion_cost(response)

            message = response.choices[0].message
            tool_calls = getattr(message, "tool_calls", None)
            if not tool_calls or not tool_executor:
                return response, total_tokens, total_cost

            messages.append(
                {
                    "role": "assistant",
                    "content": message.content,
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                        }
                        for tc in tool_calls
                    ],
                }
            )
            results = await asyncio.gather(
                *(
                    self._call_tool(tc.id, tc.function.name, tc.function.arguments, tool_executor)
                    for tc in tool_calls
                )
            )
            for tool_call_id, content, is_error in results:
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "content": f"Error: {content}" if is_error else content,
                    }
                )
        return response, total_tokens, total_cost

    async def _call_tool(
        self, tool_call_id: str, name: str, arguments_json: str, tool_executor: ToolExecutor
    ) -> tuple[str, str, bool]:
        try:
            args = json.loads(arguments_json or "{}")
        except json.JSONDecodeError:
            return tool_call_id, "invalid tool arguments (not valid JSON)", True
        try:
            content, is_error = await tool_executor(name, args)
        except Exception as exc:  # noqa: BLE001 - a tool failure is a result, not a crash
            logger.error("tool_executor_failed", tool_name=name, error=str(exc))
            return tool_call_id, f"tool execution failed: {exc}", True
        return tool_call_id, content, is_error

    async def chat_stream(
        self,
        message: str,
        history: list[dict],
        tools: list[dict] | None = None,
        tool_executor: ToolExecutor | None = None,
    ) -> AsyncIterator[str]:
        await self._resolve_api_key()
        messages = [*history, {"role": "user", "content": message}]
        for _ in range(_MAX_TOOL_ROUNDS):
            response = await litellm.acompletion(
                model=self.model,
                messages=messages,
                api_base=self.api_base,
                stream=True,
                tools=tools or None,
                **self._extra_call_kwargs(),
            )
            assistant_text = ""
            # LiteLLM/OpenAI streaming shape: tool-call args arrive as
            # string fragments across multiple chunks, keyed by index —
            # accumulate, then parse once the round finishes.
            collected: dict[int, dict] = {}
            async for chunk in response:
                delta = chunk.choices[0].delta
                if delta.content:
                    assistant_text += delta.content
                    yield delta.content
                for tc_delta in getattr(delta, "tool_calls", None) or []:
                    entry = collected.setdefault(
                        tc_delta.index, {"id": None, "name": "", "arguments": ""}
                    )
                    if tc_delta.id:
                        entry["id"] = tc_delta.id
                    if tc_delta.function and tc_delta.function.name:
                        entry["name"] += tc_delta.function.name
                    if tc_delta.function and tc_delta.function.arguments:
                        entry["arguments"] += tc_delta.function.arguments

            if not collected or not tool_executor:
                return

            messages.append(
                {
                    "role": "assistant",
                    "content": assistant_text or None,
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {"name": tc["name"], "arguments": tc["arguments"]},
                        }
                        for tc in collected.values()
                    ],
                }
            )
            results = await asyncio.gather(
                *(
                    self._call_tool(tc["id"], tc["name"], tc["arguments"], tool_executor)
                    for tc in collected.values()
                )
            )
            for tool_call_id, content, is_error in results:
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "content": f"Error: {content}" if is_error else content,
                    }
                )
            # loop continues: next round streams the model's follow-up turn

    async def is_available(self) -> bool:
        if self.model.startswith("ollama/"):
            return await check_ollama(self.api_base or get_settings().ollama_base_url)
        # A custom provider brings its own key rather than reading the
        # global ANTHROPIC_API_KEY setting — checking that setting here
        # would be checking the wrong credential entirely.
        if self.api_key:
            return True
        return bool(get_settings().anthropic_api_key)

    def get_models(self) -> list[str]:
        if self.model.startswith("ollama/"):
            return _OLLAMA_CATALOG
        # A custom provider isn't Anthropic — its catalog isn't known here
        # (LiteLLM supports ~100 providers with no single shared catalog),
        # so just offer back the model the agent is already configured
        # with rather than falsely implying Claude models are available.
        if self.api_key:
            return [self.model.split("/", 1)[-1]]
        return _ANTHROPIC_CATALOG

    def _safe_completion_cost(self, response) -> float:
        try:
            return litellm.completion_cost(response)
        except Exception as exc:  # noqa: BLE001 - pricing lookup can fail per-model
            logger.warning("litellm_cost_lookup_failed", model=self.model, error=str(exc))
            return 0.0

    def _to_result(
        self, response, tokens_used: int | None = None, cost_usd: float | None = None
    ) -> EngineResult:
        return EngineResult(
            output=response.choices[0].message.content or "",
            tokens_used=(
                tokens_used
                if tokens_used is not None
                else (response.usage.total_tokens if response.usage else 0)
            ),
            cost_usd=cost_usd if cost_usd is not None else self._safe_completion_cost(response),
        )
