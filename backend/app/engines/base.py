"""Abstract interface every agent engine (CLI or API) must implement."""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from pydantic import BaseModel, Field


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
    def chat_stream(self, message: str, history: list[dict]) -> AsyncIterator[str]:
        """Stream an interactive chat reply as incremental text deltas.

        API engines (LiteLLM) yield true token-by-token deltas. CLI engines
        can't stream mid-response (e.g. Claude Code CLI's `--print
        --output-format json` returns one blob) — they yield the complete
        reply as a single item once the subprocess finishes.
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
