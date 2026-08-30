"""Tests for the agent SOUL.md workspace-bootstrap and PUT /agents/{id}/soul."""

import os
import uuid

from httpx import AsyncClient


def _payload(**overrides) -> dict:
    base = {
        "name": "Priya",
        "role": "Screener",
        "engine_type": "api",
        "engine_provider": "anthropic",
        "personality_traits": [],
    }
    return {**base, **overrides}


async def test_create_agent_bootstraps_workspace_and_soul_for_api_engine(
    client: AsyncClient,
) -> None:
    # Regression test for the confirmed gap: nothing used to create an
    # API-engine agent's workspace root at all — only the CLI engine lazily
    # did, and only at task-execution time.
    created = (
        await client.post("/agents", json=_payload(name="Nia", engine_type="api"))
    ).json()

    assert os.path.isdir(created["working_directory"])
    soul_path = os.path.join(created["working_directory"], "SOUL.md")
    assert os.path.isfile(soul_path)
    with open(soul_path, encoding="utf-8") as f:
        assert "Nia" in f.read()


async def test_create_agent_bootstraps_workspace_and_soul_for_cli_engine(
    client: AsyncClient,
) -> None:
    created = (
        await client.post(
            "/agents",
            json=_payload(name="Arjun", engine_type="cli", engine_provider="claude_code"),
        )
    ).json()

    assert os.path.isdir(created["working_directory"])
    assert os.path.isfile(os.path.join(created["working_directory"], "SOUL.md"))


async def test_put_soul_round_trips_through_files_content(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload(name="Kabir"))).json()
    agent_id = created["id"]

    resp = await client.put(f"/agents/{agent_id}/soul", json={"content": "# Custom\n\nBe bold."})
    assert resp.status_code == 200
    assert resp.json()["content"] == "# Custom\n\nBe bold."

    read_back = (
        await client.get(f"/agents/{agent_id}/files/content", params={"path": "SOUL.md"})
    ).json()
    assert read_back["content"] == "# Custom\n\nBe bold."


async def test_put_soul_404s_for_nonexistent_agent(client: AsyncClient) -> None:
    resp = await client.put(f"/agents/{uuid.uuid4()}/soul", json={"content": "x"})
    assert resp.status_code == 404
