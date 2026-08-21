# Cubicle — Project Specification

> Self-hosted multi-agent harness with a 3D office UI, social agent behavior, voice calls, and multi-engine support.
> Install on VPS or local machine. Manage from phone. Works with Ollama ($0) or cloud APIs.

---

## 1. What Is Cubicle

Cubicle is a self-hosted, open-source AI agent harness that visualizes multiple AI agents as characters working in a 3D office. Users submit tasks, agents collaborate to complete them, and results are delivered as structured output — not raw terminal text.

What makes Cubicle different from every other agent harness:

- **Visual 3D office** — Spline-rendered office where agents sit at desks, walk around, interact
- **Social behavior** — Agents have personalities, take breaks, gossip, flirt, celebrate after tasks
- **Voice calls** — Call any agent via WebRTC + Sarvam AI (STT/TTS), talk in Hindi or English
- **Multi-engine** — Claude Code, Codex, Grok, Gemini, Ollama, OpenCode, any CLI agent or API
- **Self-hosted** — Docker Compose on VPS or local machine, manage from phone via PWA
- **Non-tech friendly** — No terminal exposure by default, structured output cards, clean UI

### Competitive Positioning

| | Munder Difflin | Cubicle |
|---|---|---|
| Platform | Electron desktop only | Web (Next.js) — any device, any browser |
| 3D | Pixi.js pixel art (non-commercial license) | Spline low-poly 3D (own assets) |
| Agents | Terminal wrappers, raw CLI output | Dual engine: CLI wrapper + direct API |
| Social | None | Full personality system, flirting, gossip |
| Voice | None | Sarvam AI — call agents in Hindi/English |
| Mobile | None | PWA — manage from phone |
| Deploy | Desktop installer | `docker compose up` — one command |
| LLM | Requires existing CLI agent subscription | Ollama ($0) or BYOK cloud API |
| Output | Raw terminal text | Structured cards, PDFs, downloadable results |

---

## 2. Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR SERVER (VPS / Local Machine)                          │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐ │
│  │ Next.js 15   │   │ FastAPI      │   │ Celery Workers │ │
│  │ Frontend     │◄─►│ Backend      │◄─►│ Agent Tasks    │ │
│  │ Spline 3D    │   │ WebSocket    │   │ Social Tasks   │ │
│  │ PWA          │   │ REST API     │   │ Voice Tasks    │ │
│  └──────────────┘   └──────┬───────┘   └───────┬────────┘ │
│                            │                    │          │
│  ┌──────────────┐   ┌──────┴───────┐   ┌───────┴────────┐ │
│  │ Caddy        │   │ Redis 7      │   │ PostgreSQL 16  │ │
│  │ Reverse Proxy│   │ Broker       │   │ + pgvector     │ │
│  │ Auto SSL     │   │ State Store  │   │ Agent Memory   │ │
│  └──────────────┘   │ Pub/Sub      │   │ Task Results   │ │
│                     │ Streams      │   │ User Settings  │ │
│                     └──────────────┘   └────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ AGENT ENGINES (user configures which ones)           │  │
│  │                                                       │  │
│  │ CLI Engines (subprocess)     API Engines (LiteLLM)   │  │
│  │ ├── Claude Code              ├── Ollama (local)      │  │
│  │ ├── Codex (OpenAI)           ├── Anthropic API       │  │
│  │ ├── Grok (xAI)              ├── OpenAI API          │  │
│  │ ├── Antigravity (Gemini)     ├── Sarvam-105B         │  │
│  │ ├── Qwen (local)            ├── Groq                │  │
│  │ ├── OpenCode                 └── Any OpenAI-compat   │  │
│  │ ├── Crush / Charm                                    │  │
│  │ └── Pi                                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────┐  (Optional)                              │
│  │ Ollama       │  Run local LLMs on GPU                   │
│  │ llama3, etc  │  $0 cost                                 │
│  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
          │ HTTPS (Caddy auto-SSL)
          ▼
   Any Browser / Phone (PWA)
```

### Dual Engine System

Cubicle supports two categories of agent engines:

**CLI Engines** — Full subprocess wrapping (like Munder Difflin)
- Claude Code: `claude --print --output-format json -p "task"`
- Codex: `codex --quiet -p "task"`
- Others: any CLI agent that accepts a prompt and returns output
- Best for: coding tasks, file operations, bash commands, git workflows
- Managed via Python `asyncio.create_subprocess_exec`

**API Engines** — Direct LLM calls via LiteLLM
- Ollama, Anthropic, OpenAI, Sarvam, Groq, any OpenAI-compatible endpoint
- Best for: research, writing, screening, analysis, social dialogue, voice
- Structured output via Instructor + Pydantic
- Much faster, cheaper, more controllable than CLI wrapping

Users choose per-agent which engine to use, exactly like Munder Difflin's "Step 2: Your Clone's Engine" screen.

---

## 3. Tech Stack

### Frontend

| Tech | Version | Purpose |
|---|---|---|
| Next.js | 15 (App Router) | Framework, SSR, file-based routing |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | latest | Accessible component library (own source) |
| Spline | @splinetool/react-spline | 3D office scene rendering |
| Lottie | lottie-react | Agent state micro-animations |
| Framer Motion | 11.x | Speech bubbles, transitions, UI animations |
| Zustand | 4.x | Client state (agent positions, moods, UI) |
| TanStack Query | 5.x | Server state (tasks, results, history) |
| Socket.io client | 4.x | Real-time agent events, social bubbles |
| next-pwa | latest | PWA manifest for mobile home screen |

### Backend

| Tech | Version | Purpose |
|---|---|---|
| Python | 3.12 | Latest async, match statements |
| FastAPI | 0.115+ | Async API server + WebSocket |
| Celery | 5.x | Agent task queue |
| Redis | 7.x | Broker + state + pub/sub + streams |
| PostgreSQL | 16 | Main DB + pgvector for memory |
| LiteLLM | 1.x | Unified LLM router (API engines) |
| Instructor | 1.x | Structured LLM output |
| Pydantic | v2 | Data validation everywhere |
| SQLAlchemy | 2.x | ORM + async sessions |
| Alembic | latest | Database migrations |
| structlog | latest | JSON structured logging |
| Sentry SDK | latest | Error tracking |
| OpenTelemetry | latest | Distributed tracing |

### Voice Layer

| Tech | Purpose |
|---|---|
| WebRTC | Browser ↔ server voice pipe |
| Sarvam Saaras v3 | Speech-to-text (23 languages, real-time WebSocket) |
| Sarvam Bulbul v3 | Text-to-speech (11 languages, customizable voice) |
| Sarvam-105B | Indian language LLM via LiteLLM |

### Infrastructure

| Tech | Purpose |
|---|---|
| Docker Compose | Entire stack in one command |
| Caddy | Reverse proxy + auto SSL |
| Ollama | Optional local LLM (Docker profile) |

---

## 4. Directory Structure

```
cubicle/
├── docker-compose.yml          # One command to start everything
├── Caddyfile                   # Reverse proxy + auto SSL
├── .env.example                # All config vars with comments
├── Makefile                    # dev, build, migrate, seed shortcuts
├── README.md                   # The star-earner
│
├── backend/                    # FastAPI + Celery
│   ├── Dockerfile
│   ├── pyproject.toml          # Poetry/uv deps
│   ├── alembic/                # DB migrations
│   │   └── versions/
│   ├── app/
│   │   ├── main.py             # FastAPI app, lifespan, middleware
│   │   ├── config.py           # Settings via pydantic-settings
│   │   ├── database.py         # SQLAlchemy async engine + session
│   │   │
│   │   ├── models/             # SQLAlchemy models
│   │   │   ├── agent.py        # Agent identity, personality, engine config
│   │   │   ├── task.py         # Task queue, status, results
│   │   │   ├── memory.py       # Agent memory entries + embeddings
│   │   │   ├── conversation.py # Chat history per agent
│   │   │   └── settings.py     # User settings, API keys (encrypted)
│   │   │
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   │   ├── agent.py
│   │   │   ├── task.py
│   │   │   ├── chat.py
│   │   │   └── settings.py
│   │   │
│   │   ├── api/                # FastAPI routers
│   │   │   ├── agents.py       # CRUD agents, list engines
│   │   │   ├── tasks.py        # Create task, get results, history
│   │   │   ├── chat.py         # Agent chat messages
│   │   │   ├── settings.py     # Engine config, API keys
│   │   │   ├── voice.py        # WebRTC signaling, Sarvam proxy
│   │   │   └── health.py       # /healthz
│   │   │
│   │   ├── engines/            # Agent execution engines
│   │   │   ├── base.py         # Abstract AgentEngine interface
│   │   │   ├── litellm_engine.py   # API-based (Ollama/Anthropic/OpenAI/etc)
│   │   │   ├── claude_code.py      # Claude Code CLI subprocess
│   │   │   ├── codex.py            # Codex CLI subprocess
│   │   │   ├── generic_cli.py      # Any CLI agent (configurable command)
│   │   │   └── registry.py         # Engine detection + registration
│   │   │
│   │   ├── workers/            # Celery tasks
│   │   │   ├── task_worker.py      # Execute agent tasks
│   │   │   ├── social_worker.py    # Generate social behavior
│   │   │   ├── voice_worker.py     # Handle voice call sessions
│   │   │   └── memory_worker.py    # Embed + store agent memories
│   │   │
│   │   ├── social/             # Personality + social behavior
│   │   │   ├── personality.py      # Agent personality profiles
│   │   │   ├── behaviors.py        # State machine: idle → social → work
│   │   │   ├── dialogue.py         # LLM-generated speech bubbles
│   │   │   └── scheduler.py        # Celery Beat social event scheduler
│   │   │
│   │   ├── voice/              # Voice call handling
│   │   │   ├── webrtc.py           # WebRTC signaling server
│   │   │   ├── sarvam_stt.py       # Saaras v3 real-time STT
│   │   │   ├── sarvam_tts.py       # Bulbul v3 TTS
│   │   │   └── session.py          # Voice call session management
│   │   │
│   │   ├── ws/                 # WebSocket handlers
│   │   │   ├── events.py           # Agent state changes → frontend
│   │   │   ├── social.py           # Social events → speech bubbles
│   │   │   └── manager.py          # Connection manager
│   │   │
│   │   └── utils/
│   │       ├── encryption.py       # AES-256 for API keys at rest
│   │       ├── engine_detect.py    # Auto-detect installed CLI agents
│   │       └── model_routing.py    # Cheap model for social, expensive for tasks
│   │
│   └── tests/
│       ├── test_engines/
│       ├── test_workers/
│       └── test_social/
│
├── frontend/                   # Next.js 15
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js          # PWA config, Spline loader
│   ├── tailwind.config.ts
│   │
│   ├── public/
│   │   ├── manifest.json       # PWA manifest
│   │   ├── icons/              # PWA icons (192, 512)
│   │   └── lottie/             # Agent animation JSON files
│   │       ├── typing.json
│   │       ├── thinking.json
│   │       ├── celebrating.json
│   │       ├── idle.json
│   │       └── coffee.json
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout, font, theme
│   │   │   ├── page.tsx            # Office view (main screen)
│   │   │   ├── setup/
│   │   │   │   └── page.tsx        # Onboarding wizard
│   │   │   └── settings/
│   │   │       └── page.tsx        # Engine config, API keys, preferences
│   │   │
│   │   ├── components/
│   │   │   ├── office/
│   │   │   │   ├── SplineScene.tsx     # 3D office canvas
│   │   │   │   ├── SpeechBubble.tsx    # Floating dialogue over agents
│   │   │   │   └── AgentOverlay.tsx    # Status badges on 3D scene
│   │   │   │
│   │   │   ├── agents/
│   │   │   │   ├── AgentCard.tsx       # Agent status card in sidebar
│   │   │   │   ├── AddAgentDialog.tsx  # Create agent: name, character, engine
│   │   │   │   └── AgentList.tsx       # Scrollable agent roster
│   │   │   │
│   │   │   ├── tasks/
│   │   │   │   ├── NewTaskDialog.tsx   # Create task: brief, assign agent(s)
│   │   │   │   ├── TaskCard.tsx        # Task status + progress
│   │   │   │   ├── TaskResult.tsx      # Structured output card
│   │   │   │   └── TaskHistory.tsx     # Past tasks list
│   │   │   │
│   │   │   ├── chat/
│   │   │   │   ├── ChatPanel.tsx       # Chat with selected agent
│   │   │   │   ├── ChatMessage.tsx     # Single message bubble
│   │   │   │   └── VoiceCallButton.tsx # "Call agent" button + WebRTC
│   │   │   │
│   │   │   ├── setup/
│   │   │   │   ├── EngineSelector.tsx  # Pick CLI or API engine
│   │   │   │   ├── OllamaDetect.tsx    # Auto-detect local Ollama
│   │   │   │   ├── ApiKeyInput.tsx     # Paste API key with validation
│   │   │   │   └── OnboardingWizard.tsx # 3-step first-run flow
│   │   │   │
│   │   │   └── ui/                 # shadcn/ui components
│   │   │       ├── button.tsx
│   │   │       ├── dialog.tsx
│   │   │       ├── card.tsx
│   │   │       └── ...
│   │   │
│   │   ├── stores/
│   │   │   ├── agentStore.ts       # Zustand: agent states, positions, moods
│   │   │   ├── taskStore.ts        # Zustand: active tasks, progress
│   │   │   └── uiStore.ts         # Zustand: selected panel, theme, layout
│   │   │
│   │   ├── hooks/
│   │   │   ├── useSocket.ts        # Socket.io connection + event handlers
│   │   │   ├── useAgents.ts        # TanStack Query: agent CRUD
│   │   │   ├── useTasks.ts         # TanStack Query: task operations
│   │   │   ├── useVoice.ts         # WebRTC voice call hook
│   │   │   └── useSpline.ts        # Spline scene event bridge
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts              # Axios/fetch client to FastAPI
│   │   │   ├── socket.ts           # Socket.io singleton
│   │   │   └── constants.ts        # Agent personalities, colors, defaults
│   │   │
│   │   └── types/
│   │       ├── agent.ts
│   │       ├── task.ts
│   │       └── events.ts
│   │
│   └── spline/
│       └── office.splinecode       # Exported Spline scene file
│
└── docs/
    ├── SETUP.md                # Installation guide
    ├── ENGINES.md              # How to configure each engine
    ├── ARCHITECTURE.md         # Technical deep-dive
    └── CONTRIBUTING.md
```

---

## 5. Database Schema

### agents table
```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,              -- "Priya", "Arjun", etc.
    role VARCHAR(50) NOT NULL,              -- "Researcher", "Dev", "Screener"
    
    -- Engine configuration
    engine_type VARCHAR(20) NOT NULL,       -- "cli" or "api"
    engine_provider VARCHAR(50) NOT NULL,   -- "claude_code", "codex", "ollama", "anthropic", etc.
    engine_model VARCHAR(100),              -- "claude-sonnet-4-5", "llama3.2", "gpt-4o"
    engine_command VARCHAR(500),            -- CLI: full command template
    working_directory VARCHAR(500),         -- CLI: repo/project path
    allowed_tools TEXT[],                   -- CLI: ["Read","Write","Bash","Edit"]
    
    -- Personality
    personality_traits TEXT[] NOT NULL,      -- ["extrovert","flirty","coffee_addict"]
    personality_quirks TEXT[],              -- freeform quirk descriptions
    voice_language VARCHAR(10) DEFAULT 'en', -- Sarvam voice language
    voice_gender VARCHAR(10) DEFAULT 'female',
    voice_pace VARCHAR(10) DEFAULT 'medium',
    
    -- Visual
    character_id VARCHAR(50),              -- Spline character reference
    accent_color VARCHAR(7) DEFAULT '#6366f1',
    desk_position INTEGER,                 -- seat assignment in office
    
    -- State
    status VARCHAR(20) DEFAULT 'idle',     -- idle, working, thinking, break, offline
    mood VARCHAR(20) DEFAULT 'neutral',    -- happy, stressed, bored, excited
    current_task_id UUID REFERENCES tasks(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### tasks table
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    brief TEXT NOT NULL,                    -- full task description
    status VARCHAR(20) DEFAULT 'pending',  -- pending, assigned, in_progress, review, completed, failed
    priority INTEGER DEFAULT 0,
    
    -- Assignment
    assigned_agents UUID[] NOT NULL,       -- which agents work on this
    orchestrator_agent_id UUID,            -- boss agent that routes subtasks
    
    -- Results
    result_structured JSONB,               -- structured output (Pydantic model)
    result_raw TEXT,                        -- raw CLI output (for dev tasks)
    result_files TEXT[],                    -- generated file paths
    
    -- Metrics
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    tokens_used INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### agent_memory table
```sql
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    content TEXT NOT NULL,                  -- what the agent remembers
    embedding vector(1536),                -- pgvector embedding
    source_task_id UUID REFERENCES tasks(id),
    memory_type VARCHAR(20) DEFAULT 'task', -- task, conversation, observation
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON agent_memory USING ivfflat (embedding vector_cosine_ops);
```

### conversations table
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    role VARCHAR(10) NOT NULL,             -- "user" or "agent"
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'chat', -- chat, voice, social
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### settings table
```sql
CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value_encrypted BYTEA,                 -- AES-256 encrypted
    value_plain TEXT,                       -- non-sensitive values
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Stores: api keys, default engine, theme, social behavior toggles
```

### social_events table
```sql
CREATE TABLE social_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(30) NOT NULL,       -- flirt, gossip, coffee, celebrate, work_chat
    from_agent_id UUID REFERENCES agents(id),
    to_agent_id UUID REFERENCES agents(id),
    dialogue TEXT,                          -- speech bubble text
    metadata JSONB,                        -- animation triggers, mood changes
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Core Flows

### Flow 1: Add Agent (mirrors Munder Difflin's 4-step wizard)

```
Step 1 — IDENTITY
├── Name: text input (e.g., "Priya")
├── Character: pick from Spline character gallery
├── Accent color: color picker
└── Personality: multi-select traits + optional quirks textarea

Step 2 — WORKSPACE (only for CLI engines)
├── Project folder: directory picker
├── Isolation: worktree / shared / none
└── Resume: paste existing context or import

Step 3 — ENGINE
├── Engine type: CLI Agent | API Model
│
├── If CLI Agent:
│   ├── Provider: Claude Code | Codex | Grok | Gemini | Qwen | OpenCode | Custom
│   ├── Model: dropdown (engine-specific, e.g., Opus 4.8, Sonnet 4.5)
│   ├── Command: auto-filled, editable (e.g., "claude --print -p")
│   └── Permissions: auto mode toggle, allowed tools checkboxes
│
└── If API Model:
    ├── Provider: Ollama (detected) | Anthropic | OpenAI | Sarvam | Groq | Custom
    ├── Model: dropdown (populated from provider)
    └── API key: use global or per-agent override

Step 4 — BRIEFING
├── Role description: what this agent does
├── Goal: one-line objective
├── System prompt: advanced, collapsed by default
└── Skills: optional skill files to attach
```

### Flow 2: Submit Task

```
User clicks [+ New Task]
  → Dialog opens:
    Title: "Screen these resumes"
    Brief: "Find top 5 Python developers from attached resumes"
    Assign to: [Priya] [Arjun] (multi-select from agent roster)
    Priority: Normal / Urgent
    Attachments: drag-and-drop files
  → Click [Start]

Backend:
  → Creates task record in Postgres
  → Celery dispatches to assigned agents
  → Each agent's engine executes:
      CLI: subprocess runs, output captured
      API: LiteLLM call with structured output
  → Results stored in task.result_structured
  → WebSocket pushes status updates to frontend

Frontend:
  → Spline scene: assigned agents start "working" animation
  → Agent cards show progress bars
  → Speech bubbles appear: "On it!" "This is a big batch..."
  → On complete: celebration animation, result card appears
```

### Flow 3: Chat With Agent

```
User clicks agent in sidebar or Spline scene
  → Right panel opens: Chat with [Priya]
  → Full message history shown
  → User types: "How's the screening going?"
  → Message sent to FastAPI → forwarded to agent's engine
      CLI: appended as follow-up prompt in existing session
      API: conversation history + new message → LiteLLM
  → Agent response streamed back via WebSocket
  → Displayed as chat bubble + speech bubble on Spline scene
```

### Flow 4: Voice Call

```
User taps [Call] button on agent card
  → WebRTC connection established (browser → FastAPI)
  → User speaks: "Priya, kitne resumes screen hue?"
  → Audio stream → Sarvam Saaras v3 (WebSocket STT)
  → Transcribed text → LiteLLM (agent personality + task context in prompt)
  → Response text → Sarvam Bulbul v3 (TTS, Priya's voice profile)
  → Audio played back in browser speaker
  
Spline scene simultaneously:
  → Priya's phone rings animation
  → She picks up, "on call" state
  → Speech bubble shows her response text
  → Other agents glance over briefly
  → On hang up: she puts phone down, resumes work
```

### Flow 5: Social Behavior (background, always running)

```
Celery Beat scheduler checks every 30 seconds:
  → Which agents are idle?
  → How long have they been idle?
  → What time is it?

Trigger conditions:
  Agent idle > 2 min            → coffee break animation
  Two agents both idle          → one walks to the other's desk
  Task just completed           → celebration sequence
  Agent idle > 5 min + another idle → gossip huddle
  6 PM system time              → end-of-day wind-down
  After good task result        → flirt attempt (if personality matches)

For each trigger:
  → Generate 1-liner via cheap model (Haiku / Ollama-mini)
  → Prompt: "{agent_name} is {personality}. Situation: {trigger}. Write ONE casual office line (max 10 words)."
  → Push social event to Redis Stream
  → WebSocket broadcasts to all connected clients
  → Frontend renders speech bubble + Spline animation
```

---

## 7. Engine Registry

### Abstract Interface

```python
# backend/app/engines/base.py

from abc import ABC, abstractmethod
from pydantic import BaseModel

class EngineResult(BaseModel):
    output: str                    # text response
    structured: dict | None = None # parsed structured output
    files_changed: list[str] = []  # for CLI engines
    tokens_used: int = 0
    cost_usd: float = 0.0
    raw_output: str | None = None  # full CLI output (dev mode)

class AgentEngine(ABC):
    @abstractmethod
    async def execute(self, prompt: str, context: dict) -> EngineResult:
        """Run a task and return structured result."""
        pass

    @abstractmethod
    async def chat(self, message: str, history: list[dict]) -> str:
        """Interactive chat with the agent."""
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if engine is installed/configured."""
        pass

    @abstractmethod
    def get_models(self) -> list[str]:
        """List available models for this engine."""
        pass
```

### CLI Engine (Claude Code example)

```python
# backend/app/engines/claude_code.py

class ClaudeCodeEngine(AgentEngine):
    async def execute(self, prompt: str, context: dict) -> EngineResult:
        process = await asyncio.create_subprocess_exec(
            "claude",
            "--print",
            "--output-format", "json",
            "--allowedTools", ",".join(context.get("allowed_tools", [])),
            "-p", prompt,
            cwd=context.get("working_dir", "."),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await process.communicate()
        result = json.loads(stdout.decode())
        return EngineResult(
            output=result.get("result", ""),
            raw_output=stdout.decode(),
            tokens_used=result.get("usage", {}).get("total_tokens", 0),
        )

    async def is_available(self) -> bool:
        return shutil.which("claude") is not None
```

### API Engine (LiteLLM)

```python
# backend/app/engines/litellm_engine.py

class LiteLLMEngine(AgentEngine):
    async def execute(self, prompt: str, context: dict) -> EngineResult:
        response = await litellm.acompletion(
            model=self.model,  # "ollama/llama3.2", "claude-sonnet-4-5", etc.
            messages=[
                {"role": "system", "content": context.get("system_prompt", "")},
                {"role": "user", "content": prompt}
            ],
            response_format=context.get("response_format"),  # Instructor schema
        )
        return EngineResult(
            output=response.choices[0].message.content,
            tokens_used=response.usage.total_tokens,
            cost_usd=litellm.completion_cost(response),
        )
```

### Engine Auto-Detection

```python
# backend/app/utils/engine_detect.py

async def detect_engines() -> dict[str, bool]:
    return {
        "claude_code": shutil.which("claude") is not None,
        "codex": shutil.which("codex") is not None,
        "grok": shutil.which("grok") is not None,
        "antigravity": shutil.which("antigravity") is not None,
        "qwen": shutil.which("qwen") is not None,
        "opencode": shutil.which("opencode") is not None,
        "ollama": await _check_ollama(),  # HTTP ping localhost:11434
        "anthropic_api": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "openai_api": bool(os.environ.get("OPENAI_API_KEY")),
        "sarvam_api": bool(os.environ.get("SARVAM_API_KEY")),
    }

async def _check_ollama() -> bool:
    try:
        async with httpx.AsyncClient() as c:
            r = await c.get("http://localhost:11434/api/tags", timeout=2)
            return r.status_code == 200
    except:
        return False
```

---

## 8. Personality System

### Trait Categories

```python
PERSONALITY_TRAITS = {
    "social": ["introvert", "extrovert", "ambivert"],
    "work": ["workaholic", "balanced", "laid_back"],
    "humor": ["dry_humor", "playful", "sarcastic", "wholesome"],
    "habits": ["coffee_addict", "tea_person", "energy_drink", "health_freak"],
    "quirks": ["perfectionist", "creative", "organized", "chaotic"],
    "social_style": ["flirty", "professional", "mentor", "gossiper"],
}
```

### Pre-built Agent Templates

Users can start from templates or build custom:

```python
AGENT_TEMPLATES = [
    {
        "name": "Priya",
        "role": "Screener",
        "traits": ["extrovert", "flirty", "coffee_addict", "organized"],
        "quirks": [
            "Walks to nearest agent's desk after every task",
            "Sends 'you okay?' when office is quiet too long",
        ],
        "accent_color": "#06b6d4",  # teal
    },
    {
        "name": "Arjun",
        "role": "Researcher",
        "traits": ["introvert", "workaholic", "dry_humor"],
        "quirks": [
            "Works late even when all tasks are done",
            "Leaves sticky notes with random facts",
        ],
        "accent_color": "#f97316",  # orange
    },
    {
        "name": "Sam",
        "role": "Writer",
        "traits": ["ambivert", "laid_back", "creative", "playful"],
        "quirks": [
            "Takes Pomodoro breaks every 25 minutes",
            "Sometimes wanders to the wrong desk",
        ],
        "accent_color": "#8b5cf6",  # purple
    },
    {
        "name": "Meera",
        "role": "QA / Critic",
        "traits": ["introvert", "perfectionist", "sarcastic", "tea_person"],
        "quirks": [
            "Reviews Sam's work twice even when done",
            "Eye-roll when errors are found",
            "Last one to leave the office every day",
        ],
        "accent_color": "#ec4899",  # pink
    },
    {
        "name": "Ravi",
        "role": "Dev",
        "engine_type": "cli",
        "engine_provider": "claude_code",
        "traits": ["introvert", "workaholic", "organized"],
        "quirks": [
            "Terminal icon always visible on his desk",
            "Gets frustrated when tests fail (mood: stressed)",
        ],
        "accent_color": "#22c55e",  # green
    },
]
```

---

## 9. Versioned Scope

### V0.1 — Core Office (4-5 weeks)
MVP. Office works. Agents do tasks. Chat works. Looks good.

- [ ] Docker Compose: FastAPI + Next.js + Postgres + Redis + Caddy
- [ ] Onboarding wizard (3-step: detect engines → config → demo task)
- [ ] Add Agent dialog (identity, engine, briefing — 4 steps like MD)
- [ ] Engine registry: Claude Code CLI + LiteLLM (Ollama/Anthropic)
- [ ] Spline 3D office scene with 4 desk positions
- [ ] Agent status system: idle → working → done
- [ ] Task creation and execution (single agent per task)
- [ ] Structured result cards (not raw terminal)
- [ ] Agent chat panel (text only)
- [ ] WebSocket: agent state → frontend updates
- [ ] Basic Lottie animations (typing, thinking, idle)
- [ ] Mobile-responsive layout
- [ ] PWA manifest

### V0.2 — Social + Multi-Engine (2-3 weeks)
The differentiator. Office comes alive.

- [ ] Social behavior scheduler (Celery Beat)
- [ ] Speech bubble system (LLM-generated dialogue)
- [ ] Agent personality system (traits, quirks, mood)
- [ ] Social interactions: coffee break, desk visit, gossip, flirt
- [ ] Celebration animation on task complete
- [ ] End-of-day wind-down sequence
- [ ] Multi-agent task routing (boss agent assigns subtasks)
- [ ] Engine expansion: Codex, Grok, Gemini, OpenCode, Qwen
- [ ] Per-agent engine override
- [ ] Agent memory (pgvector semantic search)
- [ ] Task history with search

### V1.0 — Voice + Polish (3-4 weeks)
Ship it. Public launch.

- [ ] Voice calls via WebRTC + Sarvam (STT + TTS)
- [ ] Per-agent voice profiles (language, gender, pace)
- [ ] Phone ring animation in Spline scene
- [ ] Sarvam-105B as LLM option (Indian languages)
- [ ] Download results as PDF / CSV / clipboard
- [ ] Dark/light theme toggle
- [ ] Settings page: all engine configs, API keys, social behavior toggles
- [ ] Auto-detect installed CLI agents on startup
- [ ] Permissions system (auto mode, allowed tools per agent)
- [ ] Keep-alive: agents continue working when browser closes
- [ ] README with demo GIF, comparison table, install instructions
- [ ] Landing page (single page, same Next.js app)

### V2.0 — Teams + Scale
- [ ] Multi-user auth (NextAuth)
- [ ] Role-based access (admin, member, viewer)
- [ ] Scheduled missions (like MD triggers)
- [ ] Slack/Discord webhook integration
- [ ] Agent Gallery: import/export agent configs as JSON manifests
- [ ] Custom Spline characters
- [ ] Agent skills system (attachable capability files)
- [ ] CLI: `cubicle agent add --name Priya --engine claude_code`

### V3.0 — Platform
- [ ] MCP server: expose agents as MCP tools
- [ ] Plugin system: community-built agent templates
- [ ] Multi-office: separate "floors" for different projects
- [ ] Token analytics dashboard
- [ ] Agent performance leaderboard
- [ ] Custom voice cloning (Sarvam)

---

## 10. Docker Compose

```yaml
version: "3.9"

services:
  cubicle-api:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - DATABASE_URL=postgresql+asyncpg://cubicle:cubicle@postgres:5432/cubicle
      - REDIS_URL=redis://redis:6379/0
      - OLLAMA_BASE_URL=http://ollama:11434
    volumes:
      - ./backend/app:/app/app    # hot-reload
      - agent-workspaces:/workspaces
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  cubicle-web:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://cubicle-api:8000
      - NEXT_PUBLIC_WS_URL=ws://cubicle-api:8000
    volumes:
      - ./frontend/src:/app/src   # hot-reload

  cubicle-worker:
    build: ./backend
    command: celery -A app.workers worker -l info -Q tasks,social,voice,memory
    environment:
      - DATABASE_URL=postgresql+asyncpg://cubicle:cubicle@postgres:5432/cubicle
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - agent-workspaces:/workspaces
    depends_on:
      - cubicle-api
      - redis

  cubicle-beat:
    build: ./backend
    command: celery -A app.workers beat -l info
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: cubicle
      POSTGRES_USER: cubicle
      POSTGRES_PASSWORD: cubicle
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cubicle"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

  # Optional: local LLM
  ollama:
    image: ollama/ollama
    profiles: ["ollama"]
    ports: ["11434:11434"]
    volumes:
      - ollama_models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

volumes:
  pgdata:
  redisdata:
  caddy_data:
  caddy_config:
  ollama_models:
  agent-workspaces:
```

---

## 11. README Template

```markdown
<p align="center">
  <img src="assets/logo.png" width="120" />
</p>

<h1 align="center">Cubicle</h1>

<p align="center">
  <strong>Self-hosted AI office. Watch your agents work. Talk to them. Manage from your phone.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/SAURABHRJADHAVCSE/cubicle?style=social" />
  <img src="https://img.shields.io/badge/license-MIT-blue" />
  <img src="https://img.shields.io/badge/docker-compose-blue" />
  <img src="https://img.shields.io/badge/engines-claude_code%20%7C%20codex%20%7C%20ollama%20%7C%2010%2B-green" />
</p>

<p align="center">
  <img src="assets/demo.gif" width="800" />
</p>

## What is Cubicle?

An open-source, self-hosted multi-agent harness with a 3D office UI. Your AI agents sit at desks, do work, take breaks, gossip, and sometimes flirt. You manage them from your phone.

## Why Cubicle?

| Feature | Cubicle | Munder Difflin | CrewAI | AutoGen |
|---------|---------|----------------|--------|---------|
| Visual office | 3D (Spline) | Pixel art | None | None |
| Social agents | Yes (flirt, gossip) | No | No | No |
| Voice calls | Yes (Sarvam AI) | No | No | No |
| Mobile | PWA | No | No | No |
| Self-hosted | Docker Compose | Electron | Python | Python |
| Multi-engine | 10+ CLI + API | CLI only | API only | API only |
| Non-dev friendly | Yes | No | No | No |
| Cost with Ollama | $0 | Needs subscription | API costs | API costs |

## Quick Start

```bash
git clone https://github.com/SAURABHRJADHAVCSE/cubicle.git
cd cubicle
cp .env.example .env
docker compose up -d

# With local Ollama (free):
docker compose --profile ollama up -d
```

Open `http://localhost:8000` — or point a domain for HTTPS access from anywhere.

## Supported Engines

**CLI Agents:** Claude Code · Codex · Grok · Gemini · Qwen · OpenCode · Crush · Pi · Any custom CLI
**API Models:** Ollama (local) · Anthropic · OpenAI · Sarvam · Groq · Any OpenAI-compatible

## Screenshots

[Desktop office view]
[Mobile PWA view]
[Add agent dialog]
[Voice call with Priya]
[Social interaction — flirt scene]

## Built With

FastAPI · Next.js 15 · Spline 3D · Celery · Redis · PostgreSQL · pgvector · LiteLLM · Sarvam AI · Docker

## Author

**Saurabh Jadhav** — [@SAURABHRJADHAVCSE](https://github.com/SAURABHRJADHAVCSE)

## License

MIT
```

---

## 12. Content Plan

### Launch Sequence

**Pre-launch (1 week before):**
- Teaser on LinkedIn: 15-sec screen recording of agents working + flirting
- "Building an AI office where agents gossip and flirt. Shipping next week."

**Launch day:**
- GitHub repo goes public
- Post on: r/selfhosted, r/ollama, r/LocalLLaMA, r/homelab, HackerNews
- LinkedIn post: full demo video (60 sec) + comparison table vs MD
- Twitter/X thread: 5-tweet build story

**Post-launch content (ongoing):**
- "How I built a 3D AI office with Spline + Next.js" (dev blog)
- "My AI agents started flirting" (viral clip, 30 sec)
- "Voice calling my AI agent in Hindi" (India audience clip)
- "Running an AI team on a $5 VPS with Ollama" (self-hosted angle)
- Each new engine integration = one post

### LinkedIn Post Template (launch day)

```
I built an AI office where agents actually work.

And sometimes they flirt.

Cubicle is an open-source, self-hosted multi-agent harness.
Install it on your VPS. Manage from your phone.

What makes it different:
→ 3D office (not pixel art, not terminal)
→ Agents have personalities (Priya is the extrovert, Arjun is the workaholic)
→ Call any agent by voice — in Hindi or English (Sarvam AI)
→ Works with Claude Code, Codex, Ollama, 10+ engines
→ Runs on your own hardware. $0 with Ollama.
→ Mobile PWA. Manage from bed.

[Demo GIF]

GitHub: github.com/SAURABHRJADHAVCSE/cubicle

Stack: FastAPI · Next.js · Spline 3D · Celery · Redis · PostgreSQL · LiteLLM · Sarvam AI · Docker

#OpenSource #AI #SelfHosted #Agents #BuildInPublic
```

---

## 13. Success Metrics

| Metric | Floor (V1 launch + 30 days) | Target | Stretch |
|---|---|---|---|
| GitHub stars | 500 | 2,000 | 5,000 |
| Docker pulls | 200 | 1,000 | 5,000 |
| Contributors | 2 | 5 | 15 |
| HN front page | No | Yes | Top 10 |
| Recruiter inbound | 1 | 5 | 10+ |
| LinkedIn post impressions | 10K | 50K | 200K |
