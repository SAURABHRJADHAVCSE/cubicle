"""Abstract interface every agent engine (CLI or API) must implement."""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Awaitable, Callable

from pydantic import BaseModel, Field

# A tool_executor takes (tool_name, parsed_arguments) and returns
# (result_text, is_error) — is_error lets the engine's tool loop mark the
# tool_result appropriately instead of the model seeing a failure as if it
# were a normal answer (see litellm_engine.py's tool loop).
ToolExecutor = Callable[[str, dict], Awaitable[tuple[str, bool]]]


class EngineResult(BaseModel):
    """Normalized result of running a task through any engine."""

    output: str
    structured: dict | None = None
    files_changed: list[str] = Field(default_factory=list)
    tokens_used: int = 0
    cost_usd: float = 0.0
    raw_output: str | None = None


class AgentEngine(ABC):
    """Common interface for CLI-subprocess and API-based agent engines."""

    @abstractmethod
    async def execute(self, prompt: str, context: dict) -> EngineResult:
        """Run a task and return a structured result."""

    @abstractmethod
    def chat_stream(
        self,
        message: str,
        history: list[dict],
        tools: list[dict] | None = None,
        tool_executor: ToolExecutor | None = None,
        system_prompt: str | None = None,
    ) -> AsyncIterator[str]:
        """Stream an interactive chat reply as incremental text deltas.

        API engines (LiteLLM) yield true token-by-token deltas. CLI engines
        can't stream mid-response (e.g. Claude Code CLI's `--print
        --output-format json` returns one blob) — they yield the complete
        reply as a single item once the subprocess finishes.

        ``tools``/``tool_executor`` (optional, API engines only — see
        litellm_engine.py) let the model call other agents as tools mid-chat.
        The yielded type stays plain text either way: a tool round is a side
        effect the caller's tool_executor performs (e.g. emitting websocket
        events), not a new item type in this stream. CLI engine overrides
        ignore these params — they have no tool-calling protocol to drive.

        ``system_prompt`` (optional) gives the model the agent's identity,
        SOUL.md, and tool-honesty guardrails — without it, the model has no
        framing at all and free-associates (e.g. claiming to have delegated
        a task without ever calling the delegate tool). CLI engine overrides
        ignore it too — their own `execute()` builds CLI-specific framing.
        """

    async def chat(self, message: str, history: list[dict]) -> str:
        """Send an interactive chat message and return the full reply.

        Convenience wrapper over chat_stream() for callers that don't need
        incremental delivery.
        """
        return "".join([chunk async for chunk in self.chat_stream(message, history)])

    @abstractmethod
    async def is_available(self) -> bool:
        """Return whether this engine is installed/configured and usable."""

    @abstractmethod
    def get_models(self) -> list[str]:
        """List the models this engine currently offers."""
