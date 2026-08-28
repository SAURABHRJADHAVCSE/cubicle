#!/bin/sh
# Runs as root (the image's default) just long enough to fix ownership on
# volumes Docker creates/mounts as root — a named volume's root directory is
# root-owned on first use, and claude-cli-home may still hold files from
# before this image ran as a non-root user — then hands off to `appuser` for
# the actual long-running process. Nothing past the `exec gosu` line ever
# runs as root.
set -e

for dir in /workspaces "$HOME/.claude"; do
  if [ -d "$dir" ]; then
    chown -R appuser:appuser "$dir" 2>/dev/null || true
  fi
done

exec gosu appuser "$@"
