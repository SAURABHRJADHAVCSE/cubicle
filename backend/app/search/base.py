"""Provider interface for web search/crawl. Mirrors app/media/base.py's
MediaGenerator shape, with the same deliberate contract: a provider *raises*
on failure rather than returning an empty/placeholder result — the caller
is always a tool_executor (see workers/task_worker.py's
handle_search_tool_call), and litellm_engine.py's tool loop already
converts any raised exception into a clean tool-error result the model can
react to, so there's no need for a second silent-failure protocol.

Two operations (search, extract) live on one ABC rather than getting split
across two provider hierarchies the way image/video generation did in
media/ — unlike those (genuinely different models, different result
"kind"), search and extract are the same provider/auth/base host, just two
endpoints of one API.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class SearchResult:
    title: str
    url: str
    content: str
    score: float


@dataclass
class SearchResponse:
    query: str
    answer: str | None
    results: list[SearchResult] = field(default_factory=list)


@dataclass
class ExtractResult:
    url: str
    raw_content: str


@dataclass
class ExtractResponse:
    results: list[ExtractResult] = field(default_factory=list)
    failed_urls: list[str] = field(default_factory=list)


class WebSearchProvider(ABC):
    @abstractmethod
    def is_configured(self) -> bool: ...

    @abstractmethod
    async def search(self, query: str, **kwargs: object) -> SearchResponse:
        """Raises on failure (HTTP error, malformed/empty response) — never
        returns a placeholder result. An empty `results` list from a
        genuinely successful call (nothing matched the query) is not a
        failure and must not raise."""

    @abstractmethod
    async def extract(self, urls: list[str], **kwargs: object) -> ExtractResponse:
        """Raises on failure the same way search() does. A URL that fails
        to fetch belongs in `failed_urls` on a successful response, not a
        raised exception — only a request-level failure (auth, network,
        malformed body) raises."""
