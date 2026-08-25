"""Tests for the async idle-detection pass behind the `detect_social_triggers`
Celery Beat task, and for `generate_and_emit_dialogue` (also hosted here —
see social_worker.py's module docstring for why it isn't in
app/social/dialogue.py). Both are called directly (never through Celery's
broker), with `generate_dialogue` mocked.

The idle-detection tests run against the shared dev Postgres database (per
conftest.py's db_session fixture — rollback-safe for what a test itself
inserts, but still reads whatever real rows already exist from manual
testing). So every assertion there filters `emitted` down to the specific
agent id(s) each test created, rather than assuming the `agents` table is
empty.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.workers import social_worker as social_worker_module


class _NoCloseSessionCM:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def __aenter__(self) -> AsyncSession:
        return self._session

    async def __aexit__(self, *exc_info: object) -> bool:
        return False


def _idle_agent(*, idle_for: timedelta, last_trigger: datetime | None = None, **overrides) -> Agent:
    now = datetime.now(timezone.utc)
    defaults = dict(
        name="Ravi",
        role="Dev",
        engine_type="api",
        engine_provider="anthropic",
        personality_traits=["laid_back"],
        status="idle",
        status_changed_at=now - idle_for,
        last_social_trigger_at=last_trigger,
    )
    return Agent(**{**defaults, **overrides})


def _for(emitted: list[tuple], *agent_ids: object) -> list[tuple]:
    """Filter emitted (agent_id, event_type, dialogue, target_agent_id)
    tuples down to the ones concerning this test's own agent(s)."""
    wanted = {str(a) for a in agent_ids}
    return [e for e in emitted if e[0] in wanted or e[3] in wanted]


async def _run(monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession, dialogue_line: str = "hi") -> list[tuple]:
    async def fake_generate_dialogue(agent, situation, fallback):
        return dialogue_line

    monkeypatch.setattr(
        social_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session)
    )
    monkeypatch.setattr(social_worker_module, "generate_dialogue", fake_generate_dialogue)
    emitted: list[tuple] = []
    monkeypatch.setattr(
        social_worker_module,
        "emit_social_event",
        lambda agent_id, event_type, dialogue, target_agent_id=None: emitted.append(
            (agent_id, event_type, dialogue, target_agent_id)
        ),
    )
    # Force the desk-visit branch off unless a test explicitly wants it.
    monkeypatch.setattr(social_worker_module.random, "random", lambda: 1.0)
    await social_worker_module._detect_social_triggers_async()
    return emitted


async def test_idle_past_threshold_gets_coffee_event(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent = _idle_agent(idle_for=timedelta(minutes=5))
    db_session.add(agent)
    await db_session.flush()

    emitted = _for(await _run(monkeypatch, db_session), agent.id)

    assert emitted == [(str(agent.id), "coffee", "hi", None)]
    await db_session.refresh(agent)
    assert agent.last_social_trigger_at is not None


async def test_idle_under_threshold_is_not_triggered(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent = _idle_agent(idle_for=timedelta(seconds=30))
    db_session.add(agent)
    await db_session.flush()

    emitted = _for(await _run(monkeypatch, db_session), agent.id)

    assert emitted == []


async def test_recent_trigger_is_not_re_fired_within_cooldown(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    now = datetime.now(timezone.utc)
    agent = _idle_agent(idle_for=timedelta(minutes=10), last_trigger=now - timedelta(minutes=1))
    db_session.add(agent)
    await db_session.flush()

    emitted = _for(await _run(monkeypatch, db_session), agent.id)

    assert emitted == []


async def test_cooldown_expired_fires_again(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    now = datetime.now(timezone.utc)
    agent = _idle_agent(idle_for=timedelta(minutes=10), last_trigger=now - timedelta(minutes=6))
    db_session.add(agent)
    await db_session.flush()

    emitted = _for(await _run(monkeypatch, db_session), agent.id)

    assert len(emitted) == 1


async def test_working_agents_are_ignored(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent = _idle_agent(idle_for=timedelta(minutes=10), status="working")
    db_session.add(agent)
    await db_session.flush()

    emitted = _for(await _run(monkeypatch, db_session), agent.id)

    assert emitted == []


async def test_desk_visit_pairs_two_eligible_agents(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    a = _idle_agent(idle_for=timedelta(minutes=5), name="Ravi")
    b = _idle_agent(idle_for=timedelta(minutes=5), name="Priya")
    db_session.add_all([a, b])
    await db_session.flush()

    async def fake_generate_dialogue(agent, situation, fallback):
        return "hey!"

    monkeypatch.setattr(
        social_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session)
    )
    monkeypatch.setattr(social_worker_module, "generate_dialogue", fake_generate_dialogue)
    emitted: list[tuple] = []
    monkeypatch.setattr(
        social_worker_module,
        "emit_social_event",
        lambda agent_id, event_type, dialogue, target_agent_id=None: emitted.append(
            (agent_id, event_type, dialogue, target_agent_id)
        ),
    )
    def fake_sample(population, k):
        # Real pre-existing agents in the shared dev DB may also be
        # eligible — force this test's own pair to be picked when present,
        # rather than assuming `population` is exactly [a, b].
        own = [x for x in population if x.id in (a.id, b.id)]
        return own[:k] if len(own) >= k else list(population)[:k]

    monkeypatch.setattr(social_worker_module.random, "random", lambda: 0.0)
    monkeypatch.setattr(social_worker_module.random, "sample", fake_sample)

    await social_worker_module._detect_social_triggers_async()
    own = _for(emitted, a.id, b.id)

    assert len(own) == 1
    assert own[0][1] == "desk_visit"
    assert own[0][3] in (str(a.id), str(b.id))


async def test_winddown_fires_once_per_day_after_hour(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent = _idle_agent(idle_for=timedelta(seconds=10))  # too recent for coffee
    db_session.add(agent)
    await db_session.flush()

    class _FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 1, 1, 19, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(social_worker_module, "datetime", _FixedDatetime)

    emitted = _for(await _run(monkeypatch, db_session, dialogue_line="bye"), agent.id)

    assert emitted == [(str(agent.id), "winddown", "bye", None)]

    # Same day, second tick: must not fire again.
    emitted_again = _for(await _run(monkeypatch, db_session, dialogue_line="bye"), agent.id)
    assert emitted_again == []


async def test_generate_and_emit_dialogue_emits_social_event(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent = _idle_agent(idle_for=timedelta(minutes=1))
    db_session.add(agent)
    await db_session.flush()

    async def fake_generate_dialogue(agent, situation, fallback):
        return "Coffee time!"

    monkeypatch.setattr(
        social_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session)
    )
    monkeypatch.setattr(social_worker_module, "generate_dialogue", fake_generate_dialogue)
    emitted: list[tuple] = []
    monkeypatch.setattr(
        social_worker_module,
        "emit_social_event",
        lambda agent_id, event_type, dialogue, target_agent_id=None: emitted.append(
            (agent_id, event_type, dialogue, target_agent_id)
        ),
    )

    await social_worker_module._generate_and_emit_dialogue_async(
        agent.id, "taking a break", "coffee", "Back in a sec"
    )

    assert emitted == [(str(agent.id), "coffee", "Coffee time!", None)]
