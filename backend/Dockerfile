# syntax=docker/dockerfile:1

FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# aiortc's dependencies (av/PyAV, pylibsrtp) ship manylinux wheels for
# common platforms, but self-hosting realistically includes ARM VPS/SBC
# targets without a matching wheel — these headers let `uv sync` fall back
# to compiling from source instead of failing outright.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libavdevice-dev libavfilter-dev libavformat-dev libavcodec-dev \
        libswresample-dev libswscale-dev libopus-dev libvpx-dev libsrtp2-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY app ./app
RUN uv sync --frozen

FROM python:3.12-slim AS runtime

# Node.js + npm are needed only to install the Claude Code CLI (`claude`),
# which the ClaudeCodeEngine shells out to. NodeSource's setup_lts.x script
# always resolves to whatever Node LTS is current at build time.
# The libav*/libopus/libvpx/libsrtp2 set is aiortc's runtime linkage (see
# the matching -dev install in the builder stage) — needed here too since
# these are shared libraries, not something `uv sync` bundles statically.
# gosu: drops root back to `appuser` in the entrypoint below, after the one
# thing that genuinely needs root (chown'ing the mounted volumes on first
# boot) — see the comment on `USER`/entrypoint.sh for why running as root at
# all past that point is a real functional bug here, not just a hardening
# nicety.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg gosu \
        libavdevice-dev libavfilter-dev libavformat-dev libavcodec-dev \
        libswresample-dev libswscale-dev libopus-dev libvpx-dev libsrtp2-dev \
    && curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# The Claude Code CLI itself refuses --dangerously-skip-permissions when
# running as root/sudo (a safety check on its side) — and every base image
# here runs as root by default unless a container explicitly opts out. Since
# ClaudeCodeEngine's headless subprocess has no TTY to answer an interactive
# permission prompt (see claude_code.py), it *needs* that flag to actually
# write files at all, so running as root isn't just less hardened, it
# silently breaks every CLI-engine agent's write/edit/bash tool calls.
RUN groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid appuser --create-home --shell /bin/sh appuser
ENV HOME=/home/appuser

WORKDIR /app

COPY --from=builder --chown=appuser:appuser /app /app
COPY --chown=appuser:appuser alembic.ini ./
COPY --chown=appuser:appuser alembic ./alembic
COPY --chown=appuser:appuser tests ./tests
COPY --chown=appuser:appuser docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# Starts as root (required to chown bind/named-mount volumes that were
# created by an older root-owned container, or by Docker itself on first
# use — an unprivileged user can't chown those) then `exec gosu appuser`
# hands off to the real process, which never runs as root.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:socket_app --host 0.0.0.0 --port 8000 --reload"]
