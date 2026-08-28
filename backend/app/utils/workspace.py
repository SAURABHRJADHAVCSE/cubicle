"""Safe filesystem access scoped to an agent's own workspace directory.

The workspace root comes from ``agent.working_directory`` — a free-text
column a user can type anything into (see ``schemas/agent.py``) — so every
path this module hands back to a caller-supplied ``path`` query param must be
verified to still resolve inside that root before it's read. Without that
check, a request like ``?path=../../etc/passwd`` would just work.
"""

import os
from dataclasses import dataclass


class WorkspacePathError(ValueError):
    """Raised when a requested path escapes the agent's workspace root, or
    the workspace root itself isn't configured/doesn't exist."""


@dataclass
class ResolvedPath:
    absolute: str
    relative: str  # POSIX-style, relative to the workspace root


def resolve_workspace_path(working_directory: str | None, requested_path: str) -> ResolvedPath:
    """Resolve ``requested_path`` (relative, from the API) against the
    agent's workspace root, raising ``WorkspacePathError`` if the result
    would land outside that root — the one thing this function exists to
    prevent, since the root itself is arbitrary user input.
    """
    if not working_directory:
        raise WorkspacePathError("This agent has no workspace directory configured.")

    root = os.path.realpath(working_directory)
    if not os.path.isdir(root):
        raise WorkspacePathError("This agent's workspace directory doesn't exist yet.")

    # normpath (not realpath) on the joined path first so a symlink placed
    # *inside* the workspace can't be used to point back out — realpath
    # would follow it before the containment check ever runs.
    candidate = os.path.normpath(os.path.join(root, requested_path.lstrip("/")))
    if candidate != root and not candidate.startswith(root + os.sep):
        raise WorkspacePathError("That path is outside this agent's workspace.")

    resolved = os.path.realpath(candidate)
    if resolved != root and not resolved.startswith(root + os.sep):
        raise WorkspacePathError("That path is outside this agent's workspace.")

    relative = os.path.relpath(resolved, root)
    return ResolvedPath(absolute=resolved, relative="" if relative == "." else relative.replace(os.sep, "/"))
