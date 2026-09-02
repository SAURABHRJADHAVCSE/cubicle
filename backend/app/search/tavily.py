"""Tavily search/extract, per https://docs.tavily.com's own API reference
(checked live, not guessed): POST https://api.tavily.com/search and
POST https://api.tavily.com/extract, both bearer-authenticated with the
user's own tvly-... key pasted as-is (never re-prefixed, same convention
every other key in this codebase follows).
"""

import httpx
import structlog

from app.search.base import (
    ExtractResponse,
    ExtractResult,
    SearchResponse,
    SearchResult,
    WebSearchProvider,
)

logger = structlog.get_logger()

TAVILY_SEARCH_URL = "https://api.tavily.com/search"
TAVILY_EXTRACT_URL = "https://api.tavily.com/extract"

# Cheap, fast defaults — a model can always issue a follow-up search/crawl
# for more if what comes back isn't enough, so there's no reason to default
# to Tavily's more expensive search_depth/extract_depth tiers.
DEFAULT_MAX_RESULTS = 5
DEFAULT_SEARCH_DEPTH = "basic"
DEFAULT_EXTRACT_DEPTH = "basic"


class TavilyError(Exception):
    """Raised for any failure mode — HTTP error, malformed/empty response.
    litellm_engine.py's tool loop already turns a raised exception into a
    clean tool-error result the model sees, so there's nothing consumers of
    this class need to catch specially."""


class TavilyProvider(WebSearchProvider):
    def __init__(self, api_key: str | None) -> None:
        self.api_key = api_key

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def _post(self, url: str, body: dict) -> dict:
        if not self.api_key:
            raise TavilyError("No Tavily API key configured.")
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    url,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=body,
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                # The body is where Tavily actually says what's wrong (bad
                # key, invalid params) — same lesson learned the hard way
                # with Sarvam earlier this session: str(exc) alone is just
                # "400 Bad Request", not enough to diagnose.
                logger.warning(
                    "tavily_request_failed", url=url, status=exc.response.status_code,
                    body=exc.response.text,
                )
                raise TavilyError(
                    f"Tavily API error {exc.response.status_code}: {exc.response.text}"
                ) from exc
            except httpx.HTTPError as exc:
                logger.warning("tavily_request_failed", url=url, error=str(exc))
                raise TavilyError(f"Tavily API request failed: {exc}") from exc
        try:
            return response.json()
        except ValueError as exc:
            raise TavilyError("Tavily returned a non-JSON response.") from exc

    async def search(self, query: str, **kwargs: object) -> SearchResponse:
        body = await self._post(
            TAVILY_SEARCH_URL,
            {
                "query": query,
                "search_depth": DEFAULT_SEARCH_DEPTH,
                "max_results": DEFAULT_MAX_RESULTS,
                "include_answer": True,
            },
        )
        results = [
            SearchResult(
                title=r.get("title", ""),
                url=r.get("url", ""),
                content=r.get("content", ""),
                score=r.get("score", 0.0),
            )
            for r in (body.get("results") or [])
        ]
        return SearchResponse(query=query, answer=body.get("answer"), results=results)

    async def extract(self, urls: list[str], **kwargs: object) -> ExtractResponse:
        body = await self._post(
            TAVILY_EXTRACT_URL,
            {
                "urls": urls,
                "extract_depth": DEFAULT_EXTRACT_DEPTH,
                "format": "markdown",
            },
        )
        results = [
            ExtractResult(url=r.get("url", ""), raw_content=r.get("raw_content", ""))
            for r in (body.get("results") or [])
        ]
        failed_urls = [
            f.get("url", "") if isinstance(f, dict) else str(f)
            for f in (body.get("failed_results") or [])
        ]
        if not results and not failed_urls:
            raise TavilyError("Tavily returned no results and no failure detail for this URL.")
        return ExtractResponse(results=results, failed_urls=failed_urls)
