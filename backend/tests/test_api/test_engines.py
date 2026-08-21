"""Tests for GET /engines."""

from httpx import AsyncClient


async def test_list_engines_returns_expected_keys(client: AsyncClient) -> None:
    resp = await client.get("/engines")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"claude_code", "ollama", "anthropic_api"}
    assert all(isinstance(v, bool) for v in body.values())
