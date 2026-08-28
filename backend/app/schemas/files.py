"""Request/response schemas for browsing an agent's workspace directory."""

from pydantic import BaseModel


class WorkspaceEntry(BaseModel):
    """A single file or subdirectory within a workspace listing."""

    name: str
    path: str
    type: str  # "file" | "dir"
    size: int | None = None  # bytes; None for directories


class WorkspaceListing(BaseModel):
    """A directory listing: the path it's for, plus its immediate children."""

    path: str
    entries: list[WorkspaceEntry]


class WorkspaceFileContent(BaseModel):
    """A file's content, or an explanation of why it couldn't be read."""

    path: str
    size: int
    readable: bool
    content: str | None = None
    reason: str | None = None  # set when readable is False
