"""Tests for TavilyProvider, with httpx.AsyncClient mocked out."""

import httpx
import pytest

from app.search import tavily as tavily_module
from app.search.tavily import TavilyError, TavilyProvider


class _FakeResponse:
    def __init__(self, status_code: int, json_body: dict | None = None, text: str = "") -> None:
        self.status_code = status_code
        self._json_body = json_body
        self.text = text or (str(json_body) if json_body is not None else "")

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            request = httpx.Request("POST", "https://api.tavily.com/search")
            response = httpx.Response(self.status_code, text=self.text, request=request)
            raise httpx.HTTPStatusError("error", request=request, response=response)

    def json(self) -> dict:
        if self._json_body is None:
            raise ValueError("not json")
        return self._json_body


class _FakeAsyncClient:
    def __init__(self, response: _FakeResponse) -> None:
        self._response = response
        self.posted_url: str | None = None
        self.posted_body: dict | None = None
        self.posted_headers: dict | None = None

    async def __aenter__(self) -> "_FakeAsyncClient":
        return self

    async def __aexit__(self, *exc_info: object) -> bool:
        return False

    async def post(self, url: str, headers: dict, json: dict) -> _FakeResponse:
        self.posted_url = url
        self.posted_body = json
        self.posted_headers = headers
        return self._response


def _install_fake_client(monkeypatch: pytest.MonkeyPatch, response: _FakeResponse) -> _FakeAsyncClient:
    fake_client = _FakeAsyncClient(response)
    monkeypatch.setattr(tavily_module.httpx, "AsyncClient", lambda **kwargs: fake_client)
    return fake_client


async def test_search_parses_results_and_answer(monkeypatch: pytest.MonkeyPatch) -> None:
    response = _FakeResponse(
        200,
        {
            "answer": "It's a search engine result.",
            "results": [
                {"title": "Result 1", "url": "https://a.example", "content": "content a", "score": 0.9},
                {"title": "Result 2", "url": "https://b.example", "content": "content b", "score": 0.5},
            ],
        },
    )
    fake_client = _install_fake_client(monkeypatch, response)

    provider = TavilyProvider("tvly-test-key")
    result = await provider.search("what is tavily")

    assert fake_client.posted_url == tavily_module.TAVILY_SEARCH_URL
    assert fake_client.posted_headers["Authorization"] == "Bearer tvly-test-key"
    assert fake_client.posted_body["query"] == "what is tavily"
    assert result.answer == "It's a search engine result."
    assert len(result.results) == 2
    assert result.results[0].title == "Result 1"
    assert result.results[0].url == "https://a.example"


async def test_search_raises_on_http_error_with_status_and_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = _FakeResponse(401, text='{"error": "invalid api key"}')
    _install_fake_client(monkeypatch, response)

    provider = TavilyProvider("tvly-bad-key")
    with pytest.raises(TavilyError, match="401"):
        await provider.search("anything")


async def test_search_raises_when_no_api_key_configured() -> None:
    provider = TavilyProvider(None)
    with pytest.raises(TavilyError, match="No Tavily API key"):
        await provider.search("anything")


async def test_search_raises_on_non_json_response(monkeypatch: pytest.MonkeyPatch) -> None:
    response = _FakeResponse(200, json_body=None)
    _install_fake_client(monkeypatch, response)

    provider = TavilyProvider("tvly-test-key")
    with pytest.raises(TavilyError, match="non-JSON"):
        await provider.search("anything")


async def test_extract_parses_results_and_failed_urls(monkeypatch: pytest.MonkeyPatch) -> None:
    response = _FakeResponse(
        200,
        {
            "results": [{"url": "https://a.example", "raw_content": "# Page content"}],
            "failed_results": [{"url": "https://broken.example"}],
        },
    )
    fake_client = _install_fake_client(monkeypatch, response)

    provider = TavilyProvider("tvly-test-key")
    result = await provider.extract(["https://a.example", "https://broken.example"])

    assert fake_client.posted_url == tavily_module.TAVILY_EXTRACT_URL
    assert fake_client.posted_body["urls"] == ["https://a.example", "https://broken.example"]
    assert result.results[0].raw_content == "# Page content"
    assert result.failed_urls == ["https://broken.example"]


async def test_extract_raises_when_nothing_came_back_at_all(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = _FakeResponse(200, {"results": [], "failed_results": []})
    _install_fake_client(monkeypatch, response)

    provider = TavilyProvider("tvly-test-key")
    with pytest.raises(TavilyError, match="no results"):
        await provider.extract(["https://a.example"])


def test_is_configured() -> None:
    assert TavilyProvider("tvly-real-key").is_configured() is True
    assert TavilyProvider(None).is_configured() is False
    assert TavilyProvider("").is_configured() is False
