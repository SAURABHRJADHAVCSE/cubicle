"""Abstract interface every agent engine (CLI or API) must implement."""

from abc import ABC, abstractmethod

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
    async def chat(self, message: str, history: list[dict]) -> str:
        """Send an interactive chat message and return the agent's reply."""

    @abstractmethod
    async def is_available(self) -> bool:
        """Return whether this engine is installed/configured and usable."""

    @abstractmethod
    def get_models(self) -> list[str]:
        """List the models this engine currently offers."""
