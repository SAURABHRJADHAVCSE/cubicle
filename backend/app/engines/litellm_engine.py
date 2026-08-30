"""API-based agent engine: direct LLM calls via LiteLLM (Ollama, Anthropic, ...)."""

import asyncio
from collections.abc import AsyncIterator

import litellm
import structlog

from app.config import get_settings
from app.engines.base import AgentEngine, EngineResult
from app.utils.engine_detect import check_ollama

logger = structlog.get_logger()

_OLLAMA_CATALOG = ["llama3.2", "llama3.1", "qwen2.5", "mistral"]
_ANTHROPIC_CATALOG = ["claude-opus-4-6", "claude-sonnet-4-5", "claude-haiku-4-5"]


class LiteLLMEngine(AgentEngine):
    """Runs a task or chat turn through LiteLLM against Ollama or Anthropic.

    ``model`` follows LiteLLM's provider-prefixed naming (e.g.
    ``"ollama/llama3.2"``); a bare model name (e.g. ``"claude-sonnet-4-5"``)
    is routed to Anthropic. API credentials are read by LiteLLM from the
    process environment (``ANTHROPIC_API_KEY``) — never passed explicitly.
    """

    def __init__(self, model: str, api_base: str | None = None) -> None:
        self.model = model
        self.api_base = api_base

    async def execute(self, prompt: str, context: dict) -> EngineResult:
        # Not applied to chat_stream(): that's interactive chat, where a
        # human is already watching the connection and can just close it.
        timeout = get_settings().task_timeout_seconds
        try:
            response = await asyncio.wait_for(
                litellm.acompletion(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": context.get("system_prompt", "")},
                        {"role": "user", "content": prompt},
                    ],
                    api_base=self.api_base,
                ),
                timeout=timeout,
            )
        except TimeoutError:
            logger.error("litellm_call_timeout", model=self.model, timeout_seconds=timeout)
            raise RuntimeError(f"LLM call timed out after {timeout}s") from None
        return self._to_result(response)

    async def chat_stream(self, message: str, history: list[dict]) -> AsyncIterator[str]:
        messages = [*history, {"role": "user", "content": message}]
        response = await litellm.acompletion(
            model=self.model, messages=messages, api_base=self.api_base, stream=True
        )
        async for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    async def is_available(self) -> bool:
        if self.model.startswith("ollama/"):
            return await check_ollama(self.api_base or get_settings().ollama_base_url)
        return bool(get_settings().anthropic_api_key)

    def get_models(self) -> list[str]:
        if self.model.startswith("ollama/"):
            return _OLLAMA_CATALOG
        return _ANTHROPIC_CATALOG

    def _to_result(self, response) -> EngineResult:
        try:
            cost_usd = litellm.completion_cost(response)
        except Exception as exc:  # noqa: BLE001 - pricing lookup can fail per-model
            logger.warning("litellm_cost_lookup_failed", model=self.model, error=str(exc))
            cost_usd = 0.0

        return EngineResult(
            output=response.choices[0].message.content or "",
            tokens_used=response.usage.total_tokens if response.usage else 0,
            cost_usd=cost_usd,
        )
