# Cubicle

Self-hosted, open-source multi-agent harness with a 3D office UI, social agent behavior, voice calling, and multi-engine support. See [`cubicle_spec.md`](cubicle_spec.md) for full architecture and scope.

**Status: core loop is real and working.** Create agents against 9 engines (Claude Code, OpenCode, Codex, Grok, Gemini, Antigravity, Qwen, Ollama, or the Anthropic API), assign or route tasks between them, chat, watch them work in a 3D office, and browse each agent's workspace files from the dashboard (backed by a real folder on your machine, not a hidden Docker volume). Social behavior (coffee breaks, desk visits, LLM-generated dialogue) and the full WebRTC voice-call transport are both built and verified end-to-end; wiring in real Sarvam STT/TTS credentials, gossip/flirt triggers, and a few Settings toggles are what's left. Full breakdown of what's real vs. planned: [`cubicle_spec.md`'s Current Status section](cubicle_spec.md#current-status--whats-actually-built-today).

## Quick start

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:8000/healthz
```

Open `http://localhost:3000` — the setup wizard runs on first visit and detects which engines are actually available on your machine.

## Development

```bash
make dev          # build + run with logs attached
make migrate      # apply Alembic migrations
make test         # run the backend test suite with coverage
make psql         # open a psql shell against the cubicle DB
```

## Remote access

To reach a self-hosted instance from your phone or off your home network, see [`docs/remote-access.md`](docs/remote-access.md) (Tailscale, recommended, or Cloudflare Tunnel).
