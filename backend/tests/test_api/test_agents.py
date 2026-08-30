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


# ---- bring-your-own API provider -------------------------------------------


async def test_create_agent_defaults_has_engine_api_key_false(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload())).json()
    assert created["has_engine_api_key"] is False


async def test_create_custom_provider_agent_round_trips_key(client: AsyncClient) -> None:
    resp = await client.post(
        "/agents",
        json=_payload(
            name="Gemma", engine_provider="gemini", engine_model="gemini-1.5-pro",
            engine_api_key="sk-my-gemini-key",
        ),
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["has_engine_api_key"] is True
    assert "engine_api_key" not in created
    assert "sk-my-gemini-key" not in resp.text


async def test_create_custom_provider_without_model_400(client: AsyncClient) -> None:
    resp = await client.post(
        "/agents",
        json=_payload(name="Gemma", engine_provider="gemini", engine_api_key="sk-key"),
    )
    assert resp.status_code == 400
    assert "model" in resp.json()["detail"].lower()


async def test_create_custom_provider_without_key_400(client: AsyncClient) -> None:
    resp = await client.post(
        "/agents",
        json=_payload(name="Gemma", engine_provider="gemini", engine_model="gemini-1.5-pro"),
    )
    assert resp.status_code == 400
    assert "key" in resp.json()["detail"].lower()


async def test_create_builtin_providers_never_require_model_or_key(client: AsyncClient) -> None:
    anthropic_resp = await client.post("/agents", json=_payload(name="A"))
    assert anthropic_resp.status_code == 201

    ollama_resp = await client.post(
        "/agents", json=_payload(name="O", engine_provider="ollama")
    )
    assert ollama_resp.status_code == 201


async def test_update_agent_can_rotate_key_without_resending_model(client: AsyncClient) -> None:
    created = (
        await client.post(
            "/agents",
            json=_payload(
                name="Gemma", engine_provider="gemini", engine_model="gemini-1.5-pro",
                engine_api_key="sk-old-key",
            ),
        )
    ).json()

    patch_resp = await client.patch(
        f"/agents/{created['id']}", json={"engine_api_key": "sk-new-key"}
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["has_engine_api_key"] is True
    assert "sk-new-key" not in patch_resp.text


async def test_update_agent_omitting_key_leaves_it_untouched(client: AsyncClient) -> None:
    created = (
        await client.post(
            "/agents",
            json=_payload(
                name="Gemma", engine_provider="gemini", engine_model="gemini-1.5-pro",
                engine_api_key="sk-old-key",
            ),
        )
    ).json()

    patch_resp = await client.patch(f"/agents/{created['id']}", json={"role": "New Role"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["has_engine_api_key"] is True


async def test_update_agent_can_clear_key_with_empty_string(client: AsyncClient) -> None:
    created = (
        await client.post(
            "/agents",
            json=_payload(
                name="Gemma", engine_provider="gemini", engine_model="gemini-1.5-pro",
                engine_api_key="sk-old-key",
            ),
        )
    ).json()

    patch_resp = await client.patch(f"/agents/{created['id']}", json={"engine_api_key": ""})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["has_engine_api_key"] is False


async def test_update_agent_to_custom_provider_without_model_400(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload(name="Priya"))).json()

    patch_resp = await client.patch(
        f"/agents/{created['id']}", json={"engine_provider": "gemini"}
    )
    assert patch_resp.status_code == 400
    assert "model" in patch_resp.json()["detail"].lower()
