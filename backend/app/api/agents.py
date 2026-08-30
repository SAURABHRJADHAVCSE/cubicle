"""Agent CRUD API routes."""

import os
import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentRead, AgentUpdate
from app.schemas.files import WorkspaceEntry, WorkspaceFileContent, WorkspaceListing
from app.schemas.soul import SoulRead, SoulUpdate
from app.utils.soul import default_soul_content, write_soul
from app.utils.workspace import WorkspacePathError, resolve_workspace_path

logger = structlog.get_logger()

router = APIRouter(prefix="/agents", tags=["agents"])

# Above this, a file is treated as "too large to preview" rather than read
# into memory and JSON-encoded whole — this is a text-preview endpoint, not
# a general file server.
MAX_PREVIEW_BYTES = 512_000


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


@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
async def create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db)) -> Agent:
    """Create a new agent."""
    agent = Agent(**payload.model_dump())
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
    return agent


@router.get("", response_model=list[AgentRead])
async def list_agents(db: AsyncSession = Depends(get_db)) -> list[Agent]:
    """List all agents."""
    result = await db.execute(select(Agent).order_by(Agent.created_at))
    return list(result.scalars().all())


@router.get("/{agent_id}", response_model=AgentRead)
async def get_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Agent:
    """Fetch a single agent by id."""
    return await _get_agent_or_404(agent_id, db)


@router.patch("/{agent_id}", response_model=AgentRead)
async def update_agent(
    agent_id: uuid.UUID, payload: AgentUpdate, db: AsyncSession = Depends(get_db)
) -> Agent:
    """Partially update an agent."""
    agent = await _get_agent_or_404(agent_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    await db.commit()
    await db.refresh(agent)
    logger.info("agent_updated", agent_id=str(agent.id))
    return agent


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
