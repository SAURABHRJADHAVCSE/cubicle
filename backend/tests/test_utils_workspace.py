"""Tests for resolve_workspace_path — specifically that it actually blocks
path traversal, since the workspace root is arbitrary user-typed input and
`path` is an unauthenticated-shape query param an attacker fully controls."""

import os

import pytest

from app.utils.workspace import WorkspacePathError, resolve_workspace_path


@pytest.fixture
def workspace(tmp_path):
    root = tmp_path / "agent-workspace"
    root.mkdir()
    (root / "notes.txt").write_text("hello")
    subdir = root / "subdir"
    subdir.mkdir()
    (subdir / "nested.txt").write_text("nested")
    return str(root)


def test_resolves_root(workspace):
    resolved = resolve_workspace_path(workspace, "")
    assert resolved.absolute == os.path.realpath(workspace)
    assert resolved.relative == ""


def test_resolves_nested_file(workspace):
    resolved = resolve_workspace_path(workspace, "subdir/nested.txt")
    assert resolved.relative == "subdir/nested.txt"
    assert resolved.absolute.endswith(os.path.join("subdir", "nested.txt"))


def test_rejects_dotdot_traversal(workspace):
    with pytest.raises(WorkspacePathError):
        resolve_workspace_path(workspace, "../../etc/passwd")


def test_rejects_dotdot_traversal_mid_path(workspace):
    with pytest.raises(WorkspacePathError):
        resolve_workspace_path(workspace, "subdir/../../outside.txt")


def test_leading_slash_is_neutralized_not_escaped(workspace):
    # A leading slash makes `path` *look* absolute, but it's still a
    # caller-supplied query param being joined onto the real root — the
    # lstrip("/") in resolve_workspace_path treats it as workspace-relative
    # (so "/etc/passwd" resolves to "<workspace>/etc/passwd", safely
    # contained) rather than as a real absolute filesystem path.
    resolved = resolve_workspace_path(workspace, "/subdir/nested.txt")
    assert resolved.relative == "subdir/nested.txt"
    assert resolved.absolute.startswith(os.path.realpath(workspace))


def test_rejects_symlink_escaping_root(workspace, tmp_path):
    outside = tmp_path / "outside.txt"
    outside.write_text("secret")
    link = os.path.join(workspace, "escape")
    os.symlink(str(outside), link)
    with pytest.raises(WorkspacePathError):
        resolve_workspace_path(workspace, "escape")


def test_rejects_missing_working_directory():
    with pytest.raises(WorkspacePathError):
        resolve_workspace_path(None, "")


def test_rejects_nonexistent_working_directory(tmp_path):
    missing = str(tmp_path / "does-not-exist")
    with pytest.raises(WorkspacePathError):
        resolve_workspace_path(missing, "")
