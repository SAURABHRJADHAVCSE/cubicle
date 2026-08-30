#!/bin/sh
# Runs as root (the image's default) just long enough to fix ownership on
# volumes Docker creates/mounts as root, then hands off to `appuser` for the
# actual long-running process. Nothing past the `exec gosu` line ever runs
# as root.
#
# Only claude-cli-home gets this treatment: it's a real Docker-managed named
# volume, root-owned on first use (and may still hold files from before this
# image ran as non-root). /workspaces used to be one too, but is now a host
# bind mount (./agent-workspaces) — recursively chowning a Windows-backed
# bind mount through Docker Desktop's file-sharing layer is what actually
# hung container startup here (confirmed live: chown -R sat for minutes on
# a two-file directory), and it's unnecessary besides — a host bind mount's
# permissions are governed by the host side, not by whatever first touched
# it in-container.
set -e

if [ -d "$HOME/.claude" ]; then
  chown -R appuser:appuser "$HOME/.claude" 2>/dev/null || true
fi

exec gosu appuser "$@"
