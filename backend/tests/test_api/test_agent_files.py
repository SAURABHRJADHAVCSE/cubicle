"""Tests for the agent workspace file-browsing API (GET /agents/{id}/files*)."""

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


async def test_create_agent_defaults_working_directory(client: AsyncClient) -> None:
    created = (await client.post("/agents", json=_payload(name="Nia"))).json()
    assert created["working_directory"]
    assert created["id"] in created["working_directory"]


async def test_create_agent_respects_explicit_working_directory(
    client: AsyncClient, tmp_path
) -> None:
    explicit = str(tmp_path / "custom-workspace")
    created = (
        await client.post("/agents", json=_payload(name="Rohan", working_directory=explicit))
    ).json()
    assert created["working_directory"] == explicit


async def test_list_files_empty_workspace(client: AsyncClient, tmp_path) -> None:
    root = tmp_path / "ws"
    root.mkdir()
    created = (
        await client.post("/agents", json=_payload(name="Devika", working_directory=str(root)))
    ).json()

    resp = await client.get(f"/agents/{created['id']}/files")
    assert resp.status_code == 200
    body = resp.json()
    assert body["path"] == ""
    assert body["entries"] == []


async def test_list_and_read_files(client: AsyncClient, tmp_path) -> None:
    root = tmp_path / "ws2"
    root.mkdir()
    (root / "report.md").write_text("# Hello from the agent")
    subdir = root / "output"
    subdir.mkdir()
    (subdir / "data.json").write_text('{"ok": true}')

    created = (
        await client.post("/agents", json=_payload(name="Kabir", working_directory=str(root)))
    ).json()
    agent_id = created["id"]

    listing = (await client.get(f"/agents/{agent_id}/files")).json()
    names = {e["name"] for e in listing["entries"]}
    assert names == {"report.md", "output"}
    dir_entry = next(e for e in listing["entries"] if e["name"] == "output")
    assert dir_entry["type"] == "dir"
    assert dir_entry["size"] is None
    file_entry = next(e for e in listing["entries"] if e["name"] == "report.md")
    assert file_entry["type"] == "file"
    assert file_entry["size"] == len("# Hello from the agent")

    nested = (await client.get(f"/agents/{agent_id}/files", params={"path": "output"})).json()
    assert [e["name"] for e in nested["entries"]] == ["data.json"]

    content = (
        await client.get(f"/agents/{agent_id}/files/content", params={"path": "report.md"})
    ).json()
    assert content["readable"] is True
    assert content["content"] == "# Hello from the agent"


async def test_read_file_rejects_path_traversal(client: AsyncClient, tmp_path) -> None:
    root = tmp_path / "ws3"
    root.mkdir()
    secret = tmp_path / "secret.txt"
    secret.write_text("do not read me")

    created = (
        await client.post("/agents", json=_payload(name="Tara", working_directory=str(root)))
    ).json()

    resp = await client.get(
        f"/agents/{created['id']}/files/content", params={"path": "../secret.txt"}
    )
    assert resp.status_code == 400


async def test_files_404_for_nonexistent_agent(client: AsyncClient) -> None:
    import uuid

    resp = await client.get(f"/agents/{uuid.uuid4()}/files")
    assert resp.status_code == 404
