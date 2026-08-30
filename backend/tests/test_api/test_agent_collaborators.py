"""Tests for GET/PUT /agents/{agent_id}/collaborators."""

import uuid

from httpx import AsyncClient


def _payload(**overrides) -> dict:
    base = {
        "name": "Priya",
        "role": "Manager",
        "engine_type": "api",
        "engine_provider": "anthropic",
        "personality_traits": [],
    }
    return {**base, **overrides}


async def test_collaborators_round_trip(client: AsyncClient) -> None:
    main = (await client.post("/agents", json=_payload(name="Manager"))).json()
    teammate1 = (
        await client.post("/agents", json=_payload(name="Artist", engine_type="cli", engine_provider="claude_code"))
    ).json()
    teammate2 = (await client.post("/agents", json=_payload(name="Writer"))).json()

    resp = await client.put(
        f"/agents/{main['id']}/collaborators",
        json={"collaborator_ids": [teammate1["id"], teammate2["id"]]},
    )
    assert resp.status_code == 200
    names = {c["name"] for c in resp.json()["collaborators"]}
    assert names == {"Artist", "Writer"}

    read_back = await client.get(f"/agents/{main['id']}/collaborators")
    assert read_back.status_code == 200
    assert {c["name"] for c in read_back.json()["collaborators"]} == {"Artist", "Writer"}


async def test_collaborators_replaces_full_set(client: AsyncClient) -> None:
    main = (await client.post("/agents", json=_payload(name="Manager"))).json()
    teammate1 = (await client.post("/agents", json=_payload(name="Artist"))).json()
    teammate2 = (await client.post("/agents", json=_payload(name="Writer"))).json()

    await client.put(
        f"/agents/{main['id']}/collaborators", json={"collaborator_ids": [teammate1["id"]]}
    )
    resp = await client.put(
        f"/agents/{main['id']}/collaborators", json={"collaborator_ids": [teammate2["id"]]}
    )

    names = {c["name"] for c in resp.json()["collaborators"]}
    assert names == {"Writer"}


async def test_collaborators_rejects_non_empty_list_for_cli_agent(client: AsyncClient) -> None:
    cli_agent = (
        await client.post(
            "/agents", json=_payload(name="Coder", engine_type="cli", engine_provider="claude_code")
        )
    ).json()
    teammate = (await client.post("/agents", json=_payload(name="Helper"))).json()

    resp = await client.put(
        f"/agents/{cli_agent['id']}/collaborators", json={"collaborator_ids": [teammate["id"]]}
    )
    assert resp.status_code == 400
    assert "api-engine" in resp.json()["detail"].lower()


async def test_collaborators_allows_clearing_to_empty_for_cli_agent(client: AsyncClient) -> None:
    cli_agent = (
        await client.post(
            "/agents", json=_payload(name="Coder", engine_type="cli", engine_provider="claude_code")
        )
    ).json()

    resp = await client.put(f"/agents/{cli_agent['id']}/collaborators", json={"collaborator_ids": []})
    assert resp.status_code == 200
    assert resp.json()["collaborators"] == []


async def test_collaborators_rejects_self_loop(client: AsyncClient) -> None:
    main = (await client.post("/agents", json=_payload(name="Manager"))).json()

    resp = await client.put(
        f"/agents/{main['id']}/collaborators", json={"collaborator_ids": [main["id"]]}
    )
    assert resp.status_code == 400
    assert "own teammate" in resp.json()["detail"].lower()


async def test_collaborators_rejects_unknown_agent_id(client: AsyncClient) -> None:
    main = (await client.post("/agents", json=_payload(name="Manager"))).json()

    resp = await client.put(
        f"/agents/{main['id']}/collaborators", json={"collaborator_ids": [str(uuid.uuid4())]}
    )
    assert resp.status_code == 400
    assert "unknown agent" in resp.json()["detail"].lower()


async def test_collaborators_404s_for_nonexistent_agent(client: AsyncClient) -> None:
    resp = await client.get(f"/agents/{uuid.uuid4()}/collaborators")
    assert resp.status_code == 404

    resp = await client.put(
        f"/agents/{uuid.uuid4()}/collaborators", json={"collaborator_ids": []}
    )
    assert resp.status_code == 404
