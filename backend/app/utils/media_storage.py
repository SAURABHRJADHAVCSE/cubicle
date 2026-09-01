"""Saves AI-generated media (images, video) into an agent's own workspace.

Mirrors utils/soul.py's write_soul() atomic-write pattern (resolve path,
write to a `.{uuid}.tmp` sibling, os.replace() for an atomic swap) with one
addition soul.py never needed: generated/{task_id}/ is a nested directory
that resolve_workspace_path doesn't create for you (it only requires the
workspace *root* to already exist) — os.makedirs is required first, or the
open() call below throws FileNotFoundError.
"""

import os
import uuid

from app.media.base import MIME_TO_EXT, GeneratedMedia
from app.models.agent import Agent
from app.utils.workspace import resolve_workspace_path

# Falls back to this when a provider returns a mime type outside the known
# allowlist (MIME_TO_EXT) — better than crashing the whole generation.
_FALLBACK_EXT = "bin"


async def save_generated_media(agent: Agent, media: GeneratedMedia, task_id: uuid.UUID) -> str:
    """Returns the plain workspace-relative path (no agent-id prefix — the
    "{agent_id}:{path}" composition used in Task.result_files happens one
    level up, in workers/task_worker.py, since this function has no reason
    to know about that encoding). uuid4-based filename, deliberately not
    derived from the prompt — sidesteps collision handling entirely."""
    ext = MIME_TO_EXT.get(media.mime_type, _FALLBACK_EXT)
    filename = f"{uuid.uuid4().hex}.{ext}"
    requested_path = f"generated/{task_id}/{filename}"

    resolved = resolve_workspace_path(agent.working_directory, requested_path)
    os.makedirs(os.path.dirname(resolved.absolute), exist_ok=True)
    tmp_path = f"{resolved.absolute}.{uuid.uuid4().hex}.tmp"
    with open(tmp_path, "wb") as f:
        f.write(media.data)
    os.replace(tmp_path, resolved.absolute)  # atomic on POSIX and Windows

    return resolved.relative
