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
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg \
        libavdevice-dev libavfilter-dev libavformat-dev libavcodec-dev \
        libswresample-dev libswscale-dev libopus-dev libvpx-dev libsrtp2-dev \
    && curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

WORKDIR /app

COPY --from=builder /app /app
COPY alembic.ini ./
COPY alembic ./alembic
COPY tests ./tests

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:socket_app --host 0.0.0.0 --port 8000 --reload"]
