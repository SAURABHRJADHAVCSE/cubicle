"""Tests for the Agent CRUD API."""

from httpx import AsyncClient


def _payload(**overrides) -> dict:
    base = {
        "name": "Priya",
        "role": "Screener",
        "engine_type": "api",
        "engine_provider": "anthropic",
        "personality_traits": ["extrovert", "flirty"],
    }
    return {**base, **overrides}


async def test_create_and_get_agent(client: AsyncClient) -> None:
    create_resp = await client.post("/agents", json=_payload())
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["name"] == "Priya"
    assert created["status"] == "idle"
    assert created["accent_color"] == "#6366f1"

    get_resp = await client.get(f"/agents/{created['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == created["id"]


async def test_list_agents_includes_created(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload(name="Arjun"))).json()

    list_resp = await client.get("/agents")
    assert list_resp.status_code == 200
    ids = [a["id"] for a in list_resp.json()]
    assert created["id"] in ids


async def test_update_agent(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload(name="Meera"))).json()

    patch_resp = await client.patch(f"/agents/{created['id']}", json={"mood": "excited"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["mood"] == "excited"
    assert patch_resp.json()["name"] == "Meera"


async def test_delete_agent(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload(name="Sam"))).json()

    delete_resp = await client.delete(f"/agents/{created['id']}")
    assert delete_resp.status_code == 204

    get_resp = await client.get(f"/agents/{created['id']}")
    assert get_resp.status_code == 404


async def test_get_nonexistent_agent_404(client: AsyncClient) -> None:
    import uuid

    resp = await client.get(f"/agents/{uuid.uuid4()}")
    assert resp.status_code == 404
