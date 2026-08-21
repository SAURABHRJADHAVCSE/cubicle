"""Build a concrete AgentEngine instance from an Agent's engine configuration."""

from app.config import get_settings
from app.engines.base import AgentEngine
from app.engines.claude_code import ClaudeCodeEngine
from app.engines.litellm_engine import LiteLLMEngine
from app.models.agent import Agent

_DEFAULT_OLLAMA_MODEL = "llama3.2"
_DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5"


def get_engine(agent: Agent) -> AgentEngine:
    """Return the engine instance configured for the given agent.

    Raises ValueError for an engine_type/engine_provider combination that
    isn't supported yet (Codex/Grok/etc. are V0.2 scope).
    """
    if agent.engine_type == "cli":
        if agent.engine_provider == "claude_code":
            return ClaudeCodeEngine(
                model=agent.engine_model,
                allowed_tools=agent.allowed_tools,
                working_dir=agent.working_directory,
            )
        raise ValueError(f"Unsupported CLI engine provider: {agent.engine_provider!r}")

    if agent.engine_type == "api":
        if agent.engine_provider == "ollama":
            model = agent.engine_model or _DEFAULT_OLLAMA_MODEL
            return LiteLLMEngine(
                model=f"ollama/{model}", api_base=get_settings().ollama_base_url
            )
        if agent.engine_provider == "anthropic":
            model = agent.engine_model or _DEFAULT_ANTHROPIC_MODEL
            return LiteLLMEngine(model=model)
        raise ValueError(f"Unsupported API engine provider: {agent.engine_provider!r}")

    raise ValueError(f"Unsupported engine_type: {agent.engine_type!r}")
