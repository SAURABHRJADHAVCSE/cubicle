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


async def test_files_raw_serves_binary_content_with_correct_mime(client: AsyncClient) -> None:
    """Regression coverage for a live bug: files/content (text preview,
    512KB cap) was the only way to view a workspace file, so a generated
    image either failed as "not a text file" or "too large to preview"
    depending on size. files/raw is the binary counterpart — used for
    anything files/content can't handle."""
    import os

    created = (await client.post("/agents", json=_payload(name="Wanda"))).json()
    fake_jpeg = b"\xff\xd8\xff\xe0not a real jpeg but binary enough"
    with open(os.path.join(created["working_directory"], "picture.jpg"), "wb") as f:
        f.write(fake_jpeg)

    resp = await client.get(f"/agents/{created['id']}/files/raw", params={"path": "picture.jpg"})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/jpeg"
    assert resp.content == fake_jpeg


async def test_files_raw_404_on_missing_file(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload(name="Ghost"))).json()
    resp = await client.get(f"/agents/{created['id']}/files/raw", params={"path": "nope.jpg"})
    assert resp.status_code == 404


async def test_files_raw_rejects_path_traversal(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload(name="Sneaky"))).json()
    resp = await client.get(
        f"/agents/{created['id']}/files/raw", params={"path": "../../../etc/passwd"}
    )
    assert resp.status_code == 400


async def test_files_zip_downloads_workspace_contents(client: AsyncClient) -> None:
    """Regression coverage for a live report: the vscode:// deep link
    ("Open in VS Code") doesn't resolve to anything usable when VS Code and
    the workspace's actual filesystem mount aren't on the same machine — a
    plain zip download has no such assumption."""
    import io
    import os
    import zipfile

    created = (await client.post("/agents", json=_payload(name="Jarvis"))).json()
    working_dir = created["working_directory"]
    os.makedirs(os.path.join(working_dir, "src"), exist_ok=True)
    with open(os.path.join(working_dir, "package.json"), "w") as f:
        f.write('{"name": "shoe-store"}')
    with open(os.path.join(working_dir, "src", "index.ts"), "w") as f:
        f.write("export {};")
    # Should never end up in the zip.
    os.makedirs(os.path.join(working_dir, "node_modules", "react"), exist_ok=True)
    with open(os.path.join(working_dir, "node_modules", "react", "index.js"), "w") as f:
        f.write("module.exports = {};")

    resp = await client.get(f"/agents/{created['id']}/files/zip")

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"
    assert "attachment" in resp.headers["content-disposition"]
    assert "Jarvis" in resp.headers["content-disposition"]

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        names = set(zf.namelist())
    assert "package.json" in names
    assert os.path.join("src", "index.ts").replace(os.sep, "/") in {n.replace("\\", "/") for n in names}
    assert not any("node_modules" in n for n in names)


async def test_files_zip_400s_on_a_file_path(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload(name="NotADir"))).json()
    resp = await client.get(f"/agents/{created['id']}/files/zip", params={"path": "SOUL.md"})
    assert resp.status_code == 400


async def test_files_zip_rejects_path_traversal(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload(name="SneakyZip"))).json()
    resp = await client.get(
        f"/agents/{created['id']}/files/zip", params={"path": "../../../etc"}
    )
    assert resp.status_code == 400


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


async def test_create_agent_round_trips_own_tavily_key(client: AsyncClient) -> None:
    """Mirrors test_create_custom_provider_agent_round_trips_key — an agent's
    own Tavily key (separate from engine_api_key entirely) round-trips
    through has_tavily_api_key, never echoed back raw."""
    resp = await client.post(
        "/agents", json=_payload(name="Jarvis", tavily_api_key="tvly-my-own-key"),
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["has_tavily_api_key"] is True
    assert "tavily_api_key" not in created
    assert "tvly-my-own-key" not in resp.text


async def test_create_agent_defaults_has_tavily_api_key_false(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload())).json()
    assert created["has_tavily_api_key"] is False


async def test_update_agent_rotates_and_clears_tavily_key(client: AsyncClient) -> None:
    created = (
        await client.post("/agents", json=_payload(name="Jarvis", tavily_api_key="tvly-first"))
    ).json()

    rotated = (
        await client.patch(f"/agents/{created['id']}", json={"tavily_api_key": "tvly-second"})
    ).json()
    assert rotated["has_tavily_api_key"] is True

    # Omitted entirely — untouched, still configured.
    untouched = (await client.patch(f"/agents/{created['id']}", json={"name": "Jarvis 2"})).json()
    assert untouched["has_tavily_api_key"] is True

    # Explicit "" — clears it.
    cleared = (
        await client.patch(f"/agents/{created['id']}", json={"tavily_api_key": ""})
    ).json()
    assert cleared["has_tavily_api_key"] is False


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


async def test_is_sub_agent_flips_on_collaborator_assignment(client: AsyncClient) -> None:
    main = (await client.post("/agents", json=_payload(name="Manager"))).json()
    teammate = (await client.post("/agents", json=_payload(name="Artist"))).json()
    assert main["is_sub_agent"] is False
    assert teammate["is_sub_agent"] is False

    await client.put(
        f"/agents/{main['id']}/collaborators", json={"collaborator_ids": [teammate["id"]]}
    )

    refetched_teammate = (await client.get(f"/agents/{teammate['id']}")).json()
    assert refetched_teammate["is_sub_agent"] is True
    refetched_main = (await client.get(f"/agents/{main['id']}")).json()
    assert refetched_main["is_sub_agent"] is False  # being a delegator doesn't make you one

    list_resp = await client.get("/agents")
    by_id = {a["id"]: a for a in list_resp.json()}
    assert by_id[teammate["id"]]["is_sub_agent"] is True
    assert by_id[main["id"]]["is_sub_agent"] is False


async def test_is_sub_agent_flips_back_when_unassigned(client: AsyncClient) -> None:
    main = (await client.post("/agents", json=_payload(name="Manager"))).json()
    teammate = (await client.post("/agents", json=_payload(name="Artist"))).json()
    await client.put(
        f"/agents/{main['id']}/collaborators", json={"collaborator_ids": [teammate["id"]]}
    )

    await client.put(f"/agents/{main['id']}/collaborators", json={"collaborator_ids": []})

    refetched = (await client.get(f"/agents/{teammate['id']}")).json()
    assert refetched["is_sub_agent"] is False


async def test_update_agent_to_custom_provider_without_model_400(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload(name="Priya"))).json()

    patch_resp = await client.patch(
        f"/agents/{created['id']}", json={"engine_provider": "gemini"}
    )
    assert patch_resp.status_code == 400
    assert "model" in patch_resp.json()["detail"].lower()
