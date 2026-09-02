"""Agent CRUD API routes."""

import io
import os
import re
import uuid
import zipfile

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.media.base import EXT_TO_MIME
from app.models.agent import Agent
from app.models.agent_collaborator import AgentCollaborator
from app.schemas.agent import AgentCreate, AgentRead, AgentUpdate
from app.schemas.collaborators import CollaboratorsRead, CollaboratorsUpdate
from app.schemas.files import WorkspaceEntry, WorkspaceFileContent, WorkspaceListing
from app.schemas.soul import SoulRead, SoulUpdate
from app.utils.agent_tools import get_collaborators
from app.utils.encryption import encrypt_value
from app.utils.soul import default_soul_content, write_soul
from app.utils.workspace import WorkspacePathError, resolve_workspace_path

logger = structlog.get_logger()

router = APIRouter(prefix="/agents", tags=["agents"])

# Above this, a file is treated as "too large to preview" rather than read
# into memory and JSON-encoded whole — this is a text-preview endpoint, not
# a general file server.
MAX_PREVIEW_BYTES = 512_000

# Skipped when zipping a workspace folder for download — vendor/build
# output an agent (or the user, after cloning) regenerates locally anyway
# (`npm install`, `next build`, ...), not something worth shipping in the
# download itself. Mirrors what a real project's own .gitignore would
# already exclude, even though workspaces here aren't necessarily git repos.
_ZIP_EXCLUDED_DIRS = {
    "node_modules", ".git", ".next", "dist", "build", "__pycache__",
    ".venv", "venv", ".turbo", ".cache",
}

# Mirrors engines/registry.py's own if/elif — anything else is a
# bring-your-own LiteLLM provider prefix the user typed directly.
_BUILTIN_API_PROVIDERS = {"ollama", "anthropic"}


def _validate_engine_config(
    engine_type: str,
    engine_provider: str,
    engine_model: str | None,
    engine_api_key: str | None,
    *,
    require_key: bool,
) -> None:
    """A custom (bring-your-own) API provider needs a model name always,
    and a key on creation — an update may be leaving an already-stored key
    untouched, so it isn't forced to resend one."""
    if engine_type != "api" or engine_provider in _BUILTIN_API_PROVIDERS:
        return
    if not engine_model:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Model name is required for a custom API provider.",
        )
    if require_key and not engine_api_key:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="An API key is required for a custom API provider.",
        )


def _host_path_for(absolute_container_path: str) -> str | None:
    """Map a path under ``settings.workspaces_dir`` to its host-machine
    equivalent under ``settings.host_workspaces_path``, for the UI's
    "open this folder on my PC" affordance. Returns None when that setting
    isn't configured — the bind mount works either way, this is cosmetic.
    """
    settings = get_settings()
    if not settings.host_workspaces_path:
        return None
    relative = os.path.relpath(absolute_container_path, settings.workspaces_dir)
    host_root = settings.host_workspaces_path.rstrip("/\\")
    if relative == ".":
        return host_root
    # Host is Windows in the common case; backslashes read as a real,
    # paste-into-Explorer path instead of a POSIX one that'd confuse users.
    return f"{host_root}\\{relative.replace('/', '\\')}"


async def _get_agent_or_404(agent_id: uuid.UUID, db: AsyncSession) -> Agent:
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


async def _mark_sub_agents(db: AsyncSession, agents: list[Agent]) -> list[Agent]:
    """Sets `.is_sub_agent` (a transient, non-column attribute — see
    AgentRead.is_sub_agent) on every agent in `agents`, true for any id
    that appears as someone's teammate. One query regardless of how many
    agents are being returned, rather than a per-agent lookup."""
    collaborator_ids = set(
        (await db.execute(select(AgentCollaborator.collaborator_agent_id).distinct()))
        .scalars()
        .all()
    )
    for agent in agents:
        agent.is_sub_agent = agent.id in collaborator_ids
    return agents


async def _mark_sub_agent(db: AsyncSession, agent: Agent) -> Agent:
    """Single-agent convenience wrapper over _mark_sub_agents."""
    await _mark_sub_agents(db, [agent])
    return agent


@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
async def create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db)) -> Agent:
    """Create a new agent."""
    _validate_engine_config(
        payload.engine_type, payload.engine_provider, payload.engine_model,
        payload.engine_api_key, require_key=True,
    )
    fields = payload.model_dump()
    engine_api_key = fields.pop("engine_api_key")
    agent = Agent(**fields)
    if engine_api_key:
        agent.engine_api_key_encrypted = encrypt_value(engine_api_key)
    db.add(agent)
    # Flush (not commit) first so the DB-generated id is populated in time
    # to build the default workspace path below — working_directory is a
    # free-text field the create form leaves blank in the common case, and
    # an agent with no workspace has nowhere for the file browser to show
    # anything or for a CLI engine to actually write to.
    await db.flush()
    if not agent.working_directory:
        agent.working_directory = os.path.join(get_settings().workspaces_dir, str(agent.id))
    # Every agent gets a real workspace directory + a starter SOUL.md,
    # regardless of engine_type — previously nothing created the workspace
    # root for API-engine agents at all (only the CLI engine lazily
    # os.makedirs'd one, and only at task-execution time), so an API agent's
    # working_directory pointed at a path that simply didn't exist yet.
    # Best-effort: a workspace hiccup here should never block agent creation.
    try:
        os.makedirs(agent.working_directory, exist_ok=True)
        write_soul(agent, default_soul_content(agent))
    except (OSError, WorkspacePathError) as exc:
        logger.warning("agent_workspace_bootstrap_failed", agent_id=str(agent.id), error=str(exc))
    await db.commit()
    await db.refresh(agent)
    logger.info("agent_created", agent_id=str(agent.id), name=agent.name)
    return await _mark_sub_agent(db, agent)


@router.get("", response_model=list[AgentRead])
async def list_agents(db: AsyncSession = Depends(get_db)) -> list[Agent]:
    """List all agents."""
    result = await db.execute(select(Agent).order_by(Agent.created_at))
    return await _mark_sub_agents(db, list(result.scalars().all()))


@router.get("/{agent_id}", response_model=AgentRead)
async def get_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Agent:
    """Fetch a single agent by id."""
    agent = await _get_agent_or_404(agent_id, db)
    return await _mark_sub_agent(db, agent)


@router.patch("/{agent_id}", response_model=AgentRead)
async def update_agent(
    agent_id: uuid.UUID, payload: AgentUpdate, db: AsyncSession = Depends(get_db)
) -> Agent:
    """Partially update an agent."""
    agent = await _get_agent_or_404(agent_id, db)
    fields = payload.model_dump(exclude_unset=True)
    # exclude_unset: absent = leave the stored key untouched (the common
    # case — most edits aren't about the key), sent as "" = explicit clear,
    # sent with a value = rotate it. Popped separately since it doesn't map
    # 1:1 to a real column (engine_api_key_encrypted, not engine_api_key).
    engine_api_key_sent = "engine_api_key" in fields
    engine_api_key = fields.pop("engine_api_key", None)

    _validate_engine_config(
        fields.get("engine_type", agent.engine_type),
        fields.get("engine_provider", agent.engine_provider),
        fields.get("engine_model", agent.engine_model),
        engine_api_key,
        require_key=False,
    )

    for field, value in fields.items():
        setattr(agent, field, value)
    if engine_api_key_sent:
        agent.engine_api_key_encrypted = encrypt_value(engine_api_key) if engine_api_key else None
    await db.commit()
    await db.refresh(agent)
    logger.info("agent_updated", agent_id=str(agent.id))
    return await _mark_sub_agent(db, agent)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Delete an agent."""
    agent = await _get_agent_or_404(agent_id, db)
    await db.delete(agent)
    await db.commit()
    logger.info("agent_deleted", agent_id=str(agent_id))


@router.get("/{agent_id}/files", response_model=WorkspaceListing)
async def list_workspace_files(
    agent_id: uuid.UUID, path: str = "", db: AsyncSession = Depends(get_db)
) -> WorkspaceListing:
    """List the immediate contents of a directory inside an agent's own
    workspace. ``path`` is relative to that workspace root (empty = root
    itself) — see ``resolve_workspace_path`` for how that's kept from
    escaping the root.
    """
    agent = await _get_agent_or_404(agent_id, db)
    try:
        resolved = resolve_workspace_path(agent.working_directory, path)
    except WorkspacePathError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not os.path.isdir(resolved.absolute):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="That path isn't a directory.")

    entries = []
    with os.scandir(resolved.absolute) as it:
        for entry in it:
            # Symlinks and permission-denied entries just get skipped rather
            # than 500ing the whole listing over one bad child.
            try:
                is_dir = entry.is_dir(follow_symlinks=False)
                size = None if is_dir else entry.stat(follow_symlinks=False).st_size
            except OSError:
                continue
            child_relative = f"{resolved.relative}/{entry.name}" if resolved.relative else entry.name
            entries.append(
                WorkspaceEntry(name=entry.name, path=child_relative, type="dir" if is_dir else "file", size=size)
            )
    entries.sort(key=lambda e: (e.type != "dir", e.name.lower()))

    return WorkspaceListing(
        path=resolved.relative, entries=entries, host_path=_host_path_for(resolved.absolute)
    )


@router.get("/{agent_id}/files/content", response_model=WorkspaceFileContent)
async def read_workspace_file(
    agent_id: uuid.UUID, path: str, db: AsyncSession = Depends(get_db)
) -> WorkspaceFileContent:
    """Read a single file's text content for inline preview. Refuses
    anything over ``MAX_PREVIEW_BYTES`` or that isn't valid UTF-8 text —
    this is a preview endpoint, not a general file server."""
    agent = await _get_agent_or_404(agent_id, db)
    try:
        resolved = resolve_workspace_path(agent.working_directory, path)
    except WorkspacePathError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not os.path.isfile(resolved.absolute):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="That path isn't a file.")

    size = os.path.getsize(resolved.absolute)
    if size > MAX_PREVIEW_BYTES:
        return WorkspaceFileContent(
            path=resolved.relative, size=size, readable=False, reason="File too large to preview."
        )

    with open(resolved.absolute, "rb") as f:
        raw = f.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return WorkspaceFileContent(
            path=resolved.relative, size=size, readable=False, reason="Not a text file."
        )

    return WorkspaceFileContent(path=resolved.relative, size=size, readable=True, content=text)


@router.get("/{agent_id}/files/raw")
async def read_workspace_file_raw(
    agent_id: uuid.UUID, path: str, db: AsyncSession = Depends(get_db)
) -> FileResponse:
    """Serve a workspace file's actual bytes — the general-purpose
    counterpart to files/content's text-only, size-capped preview. Needed
    for anything that route can't handle: binary media in particular (an
    image/video an agent generated, see media/gemini_image.py and
    gemini_video.py) that's either non-UTF8 or bigger than
    MAX_PREVIEW_BYTES. The frontend can't point an `<img>`/`<video>` tag
    directly at this (this whole router requires a bearer token every
    browser media tag omits) — it fetches this URL to a Blob and uses
    `URL.createObjectURL()` instead (see useWorkspaceFile.ts).
    """
    agent = await _get_agent_or_404(agent_id, db)
    try:
        resolved = resolve_workspace_path(agent.working_directory, path)
    except WorkspacePathError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not os.path.isfile(resolved.absolute):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="File not found.")

    ext = os.path.splitext(resolved.absolute)[1].lstrip(".").lower()
    return FileResponse(resolved.absolute, media_type=EXT_TO_MIME.get(ext, "application/octet-stream"))


@router.get("/{agent_id}/files/zip")
async def download_workspace_zip(
    agent_id: uuid.UUID, path: str = "", db: AsyncSession = Depends(get_db)
) -> StreamingResponse:
    """Zips a workspace directory (default: the whole workspace root) for a
    real local download. The practical fix for "vscode:// doesn't open
    anything" reports — that deep link (see host_path above) only resolves
    when VS Code and this workspace's actual filesystem mount are on the
    same machine at the same path, which isn't reliably true for every
    setup (e.g. the backend running in a container/remote host). A zip
    download has no such assumption — it always works.
    """
    agent = await _get_agent_or_404(agent_id, db)
    try:
        resolved = resolve_workspace_path(agent.working_directory, path)
    except WorkspacePathError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not os.path.isdir(resolved.absolute):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="That path isn't a directory.")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(resolved.absolute):
            dirs[:] = [d for d in dirs if d not in _ZIP_EXCLUDED_DIRS]
            for filename in files:
                file_path = os.path.join(root, filename)
                arcname = os.path.relpath(file_path, resolved.absolute)
                zip_file.write(file_path, arcname)
    buffer.seek(0)

    folder_name = os.path.basename(resolved.absolute) if resolved.relative else "workspace"
    # Content-Disposition filename is attacker-controlled (the agent's own
    # name) if left raw — strip anything but the safe characters a real
    # filename needs.
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "-", f"{agent.name}-{folder_name}").strip("-") or "workspace"
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.zip"'},
    )


@router.put("/{agent_id}/soul", response_model=SoulRead)
async def update_soul(
    agent_id: uuid.UUID, payload: SoulUpdate, db: AsyncSession = Depends(get_db)
) -> SoulRead:
    """Overwrite an agent's SOUL.md. Reading it back goes through the
    generic GET .../files/content?path=SOUL.md above — it's just a normal
    file at the workspace root."""
    agent = await _get_agent_or_404(agent_id, db)
    try:
        write_soul(agent, payload.content)
    except WorkspacePathError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    logger.info("agent_soul_updated", agent_id=str(agent.id))
    return SoulRead(content=payload.content)


@router.get("/{agent_id}/collaborators", response_model=CollaboratorsRead)
async def read_collaborators(
    agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> CollaboratorsRead:
    """The teammates this agent may delegate to as tools (see
    app/utils/agent_tools.py)."""
    agent = await _get_agent_or_404(agent_id, db)
    collaborators = await _mark_sub_agents(db, await get_collaborators(db, agent))
    return CollaboratorsRead(collaborators=collaborators)


@router.put("/{agent_id}/collaborators", response_model=CollaboratorsRead)
async def update_collaborators(
    agent_id: uuid.UUID, payload: CollaboratorsUpdate, db: AsyncSession = Depends(get_db)
) -> CollaboratorsRead:
    """Replace this agent's full teammate roster. Only an API-engine agent
    may hold a non-empty roster — only API engines (LiteLLM) have a
    structured tool-calling protocol Cubicle can drive; a CLI-subprocess
    agent can still be added as *someone else's* teammate, it just can't
    have teammates of its own.
    """
    agent = await _get_agent_or_404(agent_id, db)
    collaborator_ids = list(dict.fromkeys(payload.collaborator_ids))  # de-dupe, keep order

    if collaborator_ids and agent.engine_type != "api":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Only API-engine agents can have teammates — CLI engines have no "
            "structured tool-calling protocol to delegate through.",
        )
    if agent.id in collaborator_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="An agent can't be its own teammate.")

    if collaborator_ids:
        found = list(
            (
                await db.execute(select(Agent.id).where(Agent.id.in_(collaborator_ids)))
            )
            .scalars()
            .all()
        )
        missing = set(collaborator_ids) - set(found)
        if missing:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown agent id(s): {', '.join(str(m) for m in missing)}",
            )

    await db.execute(
        AgentCollaborator.__table__.delete().where(AgentCollaborator.agent_id == agent.id)
    )
    for collaborator_id in collaborator_ids:
        db.add(AgentCollaborator(agent_id=agent.id, collaborator_agent_id=collaborator_id))
    await db.commit()
    logger.info(
        "agent_collaborators_updated", agent_id=str(agent.id), count=len(collaborator_ids)
    )
    collaborators = await _mark_sub_agents(db, await get_collaborators(db, agent))
    return CollaboratorsRead(collaborators=collaborators)
