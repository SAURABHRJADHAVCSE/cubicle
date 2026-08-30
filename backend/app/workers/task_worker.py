"""Celery tasks: execute a Task against its assigned agent's engine, or
route it through a boss/orchestrator agent into subtasks first.

Also home to the agents-as-tools delegation path: when an agent has an
explicit teammate roster (AgentCollaborator, see app/utils/agent_tools.py),
its engine call is given those teammates as callable tools, and a tool call
recursively runs _run_task_execution() again for the target teammate — see
make_tool_executor() below. api/chat.py reuses _run_task_execution() for
the same delegation mechanics triggered from live chat rather than a Task.
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import worker_session_factory
from app.engines.base import ToolExecutor
from app.engines.registry import get_engine
from app.models.agent import Agent
from app.models.task import Task
from app.utils.agent_tools import build_tools_for_agent
from app.utils.inbox import format_inbox_context, read_and_archive_inbox, write_delegation_notice
from app.utils.memory_search import get_relevant_memories
from app.utils.push import notify_all_devices
from app.utils.soul import read_soul
from app.workers import app as celery_app
from app.workers.memory_worker import store_memory
from app.workers.social_worker import generate_and_emit_dialogue
from app.ws.events import emit_agent_status, emit_celebration, emit_task_status

logger = structlog.get_logger()


async def _cost_ceiling_exceeded(session: AsyncSession) -> bool:
    """Whether completed-task spend over the last 24h has hit the
    configured daily ceiling. False (never blocks) when unconfigured."""
    ceiling = get_settings().daily_cost_ceiling_usd
    if ceiling is None:
        return False
    window_start = datetime.now(timezone.utc) - timedelta(hours=24)
    spent = await session.scalar(
        select(func.sum(Task.cost_usd)).where(
            Task.status == "completed", Task.completed_at >= window_start
        )
    )
    return (spent or 0) >= ceiling


async def _maybe_complete_parent(session: AsyncSession, task: Task) -> None:
    """If `task` was a boss-routed child (its parent's status is "routed" —
    the marker _route_task_async sets right after dispatching children) and
    every sibling sharing its parent_task_id has now reached a terminal
    state, aggregate their results into the parent and mark it
    completed/failed too.

    Gated on parent.status == "routed" specifically (not just "not
    completed/failed") because parent_task_id is now also set on
    agents-as-tools delegation children (see make_tool_executor) — there,
    the "parent" is a task whose own engine call is still actively running
    (status "in_progress"), and it completes itself via its own
    _run_task_execution tail once that call returns. Treating an
    in-progress delegator as if it were a decomposition parent would
    complete it out from under its own still-running execution.
    """
    if task.parent_task_id is None:
        return

    parent = await session.get(Task, task.parent_task_id)
    if parent is None or parent.status != "routed":
        return

    siblings = list(
        (
            await session.execute(select(Task).where(Task.parent_task_id == task.parent_task_id))
        )
        .scalars()
        .all()
    )
    if any(s.status not in ("completed", "failed") for s in siblings):
        return  # still waiting on at least one child

    children_summary = [
        {"agent_id": str(s.assigned_agents[0]) if s.assigned_agents else None,
         "status": s.status, "result_structured": s.result_structured}
        for s in siblings
    ]
    parent.result_structured = {
        **(parent.result_structured or {}),
        "children": children_summary,
    }
    parent.status = "completed" if all(s.status == "completed" for s in siblings) else "failed"
    parent.completed_at = datetime.now(timezone.utc)
    await session.commit()
    emit_task_status(str(parent.id), parent.status)
    logger.info(
        "route_task_parent_completed", task_id=str(parent.id), status=parent.status,
        child_count=len(siblings),
    )


async def dependencies_satisfied(session: AsyncSession, task: Task) -> bool:
    """Whether every task in `task.depends_on` has reached "completed".

    A dependency id that doesn't resolve to a real row (deleted, typo'd)
    counts as unsatisfied rather than being silently skipped — logged so
    it's visible instead of a task just sitting blocked with no clue why.
    """
    if not task.depends_on:
        return True
    deps = list(
        (await session.execute(select(Task).where(Task.id.in_(task.depends_on)))).scalars().all()
    )
    if len(deps) != len(task.depends_on):
        found = {d.id for d in deps}
        missing = [str(dep_id) for dep_id in task.depends_on if dep_id not in found]
        logger.warning("task_dependency_missing", task_id=str(task.id), missing=missing)
        return False
    return all(d.status == "completed" for d in deps)


async def _promote_blocked_dependents(session: AsyncSession, completed_task: Task) -> None:
    """Dispatch any "blocked" task whose dependencies are now all satisfied
    because `completed_task` just finished. Only called when a task reaches
    "completed" — a failure can never satisfy a dependent."""
    candidates = list(
        (
            await session.execute(
                select(Task).where(
                    Task.status == "blocked", Task.depends_on.any(completed_task.id)
                )
            )
        )
        .scalars()
        .all()
    )
    for candidate in candidates:
        if await dependencies_satisfied(session, candidate):
            await dispatch_task(session, candidate)


async def dispatch_task(session: AsyncSession, task: Task) -> None:
    """Mark a pending task assigned and hand it to Celery — the same tail
    api/tasks.py's execute_task_route used to run inline, extracted here
    (not into api/tasks.py) so both it and the webhook route in
    api/webhooks.py can call it without api/tasks.py importing from
    task_worker.py while task_worker.py also imports from api/tasks.py,
    which would be a circular import. Callers own checking the task is
    actually eligible to dispatch (status, dependencies) before calling
    this — it dispatches unconditionally.
    """
    task.status = "assigned"
    await session.commit()
    if task.orchestrator_agent_id is not None:
        route_task.delay(str(task.id))
        logger.info("task_routed", task_id=str(task.id))
    else:
        execute_task.delay(str(task.id))
        logger.info("task_dispatched", task_id=str(task.id))


@celery_app.task(name="execute_task")
def execute_task(task_id: str) -> None:
    """Synchronous Celery entrypoint; runs the async implementation to completion."""
    asyncio.run(_execute_task_async(uuid.UUID(task_id)))


async def _execute_task_async(task_id: uuid.UUID) -> None:
    """Load the task and its agent and run it — the Celery-entrypoint-only
    checks (task/agent actually exist) live here; the shared execution body
    (cost ceiling, engine call, persistence, side effects) is
    _run_task_execution, also used by agents-as-tools delegation."""
    async with worker_session_factory() as session:
        task = await session.get(Task, task_id)
        if task is None:
            logger.error("execute_task_missing_task", task_id=str(task_id))
            return

        if not task.assigned_agents:
            await _mark_failed(session, task, "Task has no assigned agents")
            return

        agent = await session.get(Agent, task.assigned_agents[0])
        if agent is None:
            await _mark_failed(session, task, "Assigned agent not found")
            return

        await _run_task_execution(session, task, agent, call_chain=[agent.id])


def make_tool_executor(
    calling_task_id: uuid.UUID | None,
    tool_by_name: dict[str, uuid.UUID],
    call_chain: list[uuid.UUID],
    session_factory=None,
    on_delegation_start=None,
    on_delegation_end=None,
) -> ToolExecutor:
    """Builds the tool_executor an engine's tool loop calls per tool_use.

    Shared by the task-dispatch path (_run_task_execution, below) and
    api/chat.py's live-chat delegation — chat.py passes its own
    `session_factory` (the API process's pooled `async_session_factory`,
    not the Celery-only `worker_session_factory` default) plus
    `on_delegation_start`/`on_delegation_end` callbacks that emit
    `chat_tool_call_started`/`_finished` over the websocket, since chat has
    no other way to show a mid-conversation delegation is happening.

    `session_factory` defaults to None rather than binding
    `worker_session_factory` directly as the parameter default — a default
    value is evaluated once at function-definition time, which would freeze
    in the pre-monkeypatch factory and break tests that patch
    `task_worker_module.worker_session_factory`. Resolved by name inside
    `tool_executor` instead (see below), same as every other call site in
    this module.

    Each call opens its own fresh session rather than reusing the session
    `agent`/`tool_by_name` were loaded from — parallel tool calls run
    concurrently via asyncio.gather in the engine's tool loop, and a single
    AsyncSession isn't safe to use from more than one coroutine at a time.
    Re-fetching the target agent by id in that fresh session is the price
    of that safety; it's one extra cheap lookup per delegated call.
    """

    async def tool_executor(tool_name: str, args: dict) -> tuple[str, bool]:
        target_id = tool_by_name.get(tool_name)
        if target_id is None:
            return f"Unknown tool: {tool_name}", True
        if target_id in call_chain:
            return (
                "Cannot delegate here — this teammate is already earlier in this "
                "delegation chain, which would create a cycle.",
                True,
            )
        max_depth = get_settings().max_orchestration_depth
        if len(call_chain) >= max_depth:
            return (
                f"Delegation depth limit ({max_depth}) reached — cannot delegate further.",
                True,
            )
        brief = (args or {}).get("brief", "").strip()
        if not brief:
            return "Missing required 'brief' argument.", True

        factory = session_factory or worker_session_factory
        async with factory() as child_session:
            target = await child_session.get(Agent, target_id)
            if target is None:
                return "That teammate no longer exists.", True

            child = Task(
                title=f"Delegated to {target.name}",
                brief=brief,
                assigned_agents=[target.id],
                parent_task_id=calling_task_id,
                status="pending",
            )
            child_session.add(child)
            await child_session.flush()

            if on_delegation_start is not None:
                await on_delegation_start(target, child, brief)

            await _run_task_execution(
                child_session, child, target, call_chain=[*call_chain, target.id]
            )

            if on_delegation_end is not None:
                await on_delegation_end(target, child)

            if child.status == "completed":
                return child.result_raw or "(no output)", False
            return child.result_raw or "Delegated task failed with no error message.", True

    return tool_executor


async def _run_task_execution(
    session: AsyncSession, task: Task, agent: Agent, call_chain: list[uuid.UUID]
) -> None:
    """Run `task` against `agent`'s engine, persist the result, and emit the
    usual status/dialogue/memory side effects. Shared by the Celery
    entrypoint (execute_task, call_chain=[agent.id]) and recursive
    agents-as-tools delegation (make_tool_executor, call_chain=[...,
    agent.id]) — mutates `task`/`agent` in place; callers that need the
    outcome read task.status/result_raw afterward (see make_tool_executor).
    """
    if await _cost_ceiling_exceeded(session):
        await _mark_failed(session, task, "Daily cost ceiling exceeded", agent=agent)
        return

    task.status = "in_progress"
    task.started_at = datetime.now(timezone.utc)
    agent.status = "working"
    agent.status_changed_at = datetime.now(timezone.utc)
    agent.current_task_id = task.id
    await session.commit()
    emit_task_status(str(task.id), task.status)
    emit_agent_status(str(agent.id), agent.status, agent.mood, str(task.id))
    generate_and_emit_dialogue.delay(
        str(agent.id), f"just started working on: {task.title}", "work_chat", "On it!"
    )

    try:
        engine = get_engine(agent)
        # Delegation notices left by route_task() (see app/utils/inbox.py)
        # get folded into the transient prompt, not task.brief itself —
        # engines only read context["system_prompt"]/["working_dir"],
        # there's nowhere else for this to reach the model.
        inbox_context = format_inbox_context(read_and_archive_inbox(agent))
        # SOUL.md (identity/behavior, see app/utils/soul.py) and relevant
        # past memories both belong in system_prompt, not the task-brief
        # text — they're about who the agent is and what it already
        # knows, not the specific job at hand. get_relevant_memories
        # already fails soft internally (returns [] if embedding fails),
        # so no extra error handling is needed here.
        system_prompt = f"You are {agent.name}, a {agent.role}."
        soul = read_soul(agent)
        if soul:
            system_prompt += f"\n\n{soul}"
        memories = await get_relevant_memories(session, agent, task.brief)
        if memories:
            system_prompt += "\n\nRelevant past experience:\n" + "\n".join(
                f"- {m}" for m in memories
            )

        # Agents-as-tools: a non-empty roster (API-engine agents only, see
        # agent_tools.py) turns this into a tool-calling turn instead of a
        # single-shot completion — the engine's own tool loop (see
        # litellm_engine.py) drives it.
        tools, tool_agents_by_name = await build_tools_for_agent(session, agent)
        tool_executor = None
        if tools:
            tool_by_id = {name: a.id for name, a in tool_agents_by_name.items()}
            tool_executor = make_tool_executor(task.id, tool_by_id, call_chain)

        result = await engine.execute(
            inbox_context + task.brief,
            context={
                "system_prompt": system_prompt,
                "working_dir": agent.working_directory,
                "tools": tools,
                "tool_executor": tool_executor,
            },
        )
    except Exception as exc:  # noqa: BLE001 - any engine failure marks the task failed
        logger.error("execute_task_failed", task_id=str(task.id), error=str(exc))
        await _mark_failed(session, task, str(exc), agent=agent)
        return

    task.status = "completed"
    task.result_raw = result.raw_output or result.output
    task.result_structured = result.structured
    task.result_files = result.files_changed or None
    task.tokens_used = result.tokens_used
    task.cost_usd = result.cost_usd
    task.completed_at = datetime.now(timezone.utc)

    agent.status = "idle"
    agent.status_changed_at = datetime.now(timezone.utc)
    agent.current_task_id = None

    await session.commit()
    emit_task_status(str(task.id), task.status)
    emit_agent_status(str(agent.id), agent.status, agent.mood, None)
    emit_celebration(str(agent.id))
    generate_and_emit_dialogue.delay(
        str(agent.id), f"just finished working on: {task.title}", "work_chat", "Done! 🎉"
    )
    store_memory.delay(
        str(agent.id),
        f"Task '{task.title}': {result.output}",
        str(task.id),
        "task",
    )
    await notify_all_devices(session, f"{agent.name} finished a task", task.title)
    await _maybe_complete_parent(session, task)
    await _promote_blocked_dependents(session, task)
    logger.info("execute_task_completed", task_id=str(task.id))


async def _mark_failed(
    session: AsyncSession, task: Task, error: str, agent: Agent | None = None
) -> None:
    """Record a task failure and free up its agent, if any."""
    task.status = "failed"
    task.result_raw = error
    task.completed_at = datetime.now(timezone.utc)
    if agent is not None:
        agent.status = "idle"
        agent.status_changed_at = datetime.now(timezone.utc)
        agent.current_task_id = None
    await session.commit()
    emit_task_status(str(task.id), task.status)
    if agent is not None:
        emit_agent_status(str(agent.id), agent.status, agent.mood, None)
    await notify_all_devices(session, f"Task failed: {task.title}", error[:200])
    await _maybe_complete_parent(session, task)


@celery_app.task(name="route_task")
def route_task(task_id: str) -> None:
    """Synchronous Celery entrypoint; runs the async implementation to completion."""
    asyncio.run(_route_task_async(uuid.UUID(task_id)))


def _parse_subtasks(raw_output: str, roster_by_id: dict[str, Agent]) -> list[dict] | None:
    """Extract a validated subtask list from the orchestrator's response.

    Returns None on any malformed/unusable output — callers treat that as
    "decomposition failed" and fall back to a single subtask. LLMs commonly
    wrap JSON in prose despite instructions not to, so this tries a raw
    parse first, then falls back to slicing out the first `[...]` span.
    """
    try:
        data = json.loads(raw_output)
    except json.JSONDecodeError:
        start, end = raw_output.find("["), raw_output.rfind("]")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            data = json.loads(raw_output[start : end + 1])
        except json.JSONDecodeError:
            return None

    if not isinstance(data, list) or not data:
        return None

    subtasks: list[dict] = []
    for item in data:
        if not isinstance(item, dict):
            return None
        agent_id, title, brief = item.get("agent_id"), item.get("title"), item.get("brief")
        if not (agent_id and title and brief) or agent_id not in roster_by_id:
            return None
        subtasks.append({"agent_id": agent_id, "title": title, "brief": brief})
    return subtasks


async def _route_task_async(task_id: uuid.UUID) -> None:
    """Have the task's orchestrator agent decompose it into subtasks and
    dispatch each to the assigned teammate, falling back to routing the
    whole brief to the orchestrator itself if decomposition fails.

    This is the single-shot decompose-once path (task.orchestrator_agent_id)
    — distinct from the recursive agents-as-tools delegation in
    _run_task_execution/make_tool_executor above, which activates for any
    task whose *assigned* agent has an explicit teammate roster, regardless
    of orchestrator_agent_id.
    """
    async with worker_session_factory() as session:
        task = await session.get(Task, task_id)
        if task is None:
            logger.error("route_task_missing_task", task_id=str(task_id))
            return

        if task.orchestrator_agent_id is None:
            await _mark_failed(session, task, "Task has no orchestrator_agent_id")
            return

        orchestrator = await session.get(Agent, task.orchestrator_agent_id)
        if orchestrator is None:
            await _mark_failed(session, task, "Orchestrator agent not found")
            return

        if await _cost_ceiling_exceeded(session):
            # No `agent=` here, matching this function's existing failure
            # paths above — _route_task_async never puts the orchestrator
            # into a "working" state in the first place, so there's nothing
            # for _mark_failed to reset back to idle.
            await _mark_failed(session, task, "Daily cost ceiling exceeded")
            return

        roster = list((await session.execute(select(Agent))).scalars().all())
        roster_by_id = {str(a.id): a for a in roster}

        subtasks: list[dict] | None = None
        try:
            engine = get_engine(orchestrator)
            roster_lines = "\n".join(
                f"- {a.id} | {a.name} | {a.role}" for a in roster if a.id != orchestrator.id
            )
            prompt = (
                "Break the following request into one or more subtasks and assign each "
                f"to the best-fit teammate from this roster:\n{roster_lines}\n\n"
                f"Request: {task.brief}\n\n"
                "Respond with ONLY a JSON array, no other text, in this exact shape: "
                '[{"agent_id": "<uuid from roster>", "title": "<short title>", '
                '"brief": "<what they should do>"}]'
            )
            orchestrator_system_prompt = (
                f"You are {orchestrator.name}, a {orchestrator.role} who manages a team."
            )
            orchestrator_soul = read_soul(orchestrator)
            if orchestrator_soul:
                orchestrator_system_prompt += f"\n\n{orchestrator_soul}"
            result = await engine.execute(
                prompt,
                context={"system_prompt": orchestrator_system_prompt},
            )
            subtasks = _parse_subtasks(result.raw_output or result.output, roster_by_id)
        except Exception as exc:  # noqa: BLE001 - any routing failure falls back to one subtask
            logger.warning("route_task_decompose_failed", task_id=str(task.id), error=str(exc))

        if not subtasks:
            subtasks = [{"agent_id": str(orchestrator.id), "title": task.title, "brief": task.brief}]

        child_ids: list[str] = []
        for sub in subtasks:
            child = Task(
                title=sub["title"],
                brief=sub["brief"],
                assigned_agents=[uuid.UUID(sub["agent_id"])],
                orchestrator_agent_id=orchestrator.id,
                parent_task_id=task.id,
                status="pending",
            )
            session.add(child)
            await session.flush()
            child_ids.append(str(child.id))
            write_delegation_notice(roster_by_id[sub["agent_id"]], task, child)

        task.status = "routed"
        task.result_structured = {"child_task_ids": child_ids}
        await session.commit()
        emit_task_status(str(task.id), task.status)
        logger.info("route_task_completed", task_id=str(task.id), child_count=len(child_ids))

        for child_id in child_ids:
            execute_task.delay(child_id)


# A task's own in-process timeout (asyncio.wait_for in the engines) and
# Celery's task_time_limit backstop both only protect against a hang *inside
# a still-running process*. Neither helps if the worker process itself dies
# mid-task — a restart, a crash, an OOM kill — since nothing then tells the
# DB row the process is gone. Confirmed live: a task sat "in_progress" for
# nearly 2 hours with zero tokens/cost and zero matching Celery active tasks,
# because a worker restart during a deploy killed it mid-flight and nothing
# ever reconciled the row. This sweep is that reconciliation.
ORPHAN_GRACE_SECONDS = 300  # comfortably past task_timeout_seconds + Celery's own +60s hard limit


@celery_app.task(name="reconcile_orphaned_tasks")
def reconcile_orphaned_tasks() -> None:
    """Synchronous Celery entrypoint; runs the async implementation to completion."""
    asyncio.run(_reconcile_orphaned_tasks_async())


async def _reconcile_orphaned_tasks_async() -> None:
    """Find tasks stuck in "in_progress"/"assigned" long enough that they
    can't still be legitimately executing (the in-process timeout would
    have caught a real hang well before this point), and fail them via the
    normal _mark_failed path — which also frees their agent and, via the
    existing terminal-state hook, unblocks/re-aggregates anything waiting
    on them. Purely time-based (no live Celery inspect() round-trip): once
    a task is older than task_timeout_seconds + ORPHAN_GRACE_SECONDS, it is
    orphaned regardless of *why* the owning process is gone.
    """
    threshold = datetime.now(timezone.utc) - timedelta(
        seconds=get_settings().task_timeout_seconds + ORPHAN_GRACE_SECONDS
    )
    async with worker_session_factory() as session:
        stale = list(
            (
                await session.execute(
                    select(Task).where(
                        Task.status.in_(["in_progress", "assigned"]), Task.updated_at < threshold
                    )
                )
            )
            .scalars()
            .all()
        )
        for task in stale:
            agent = await session.get(Agent, task.assigned_agents[0]) if task.assigned_agents else None
            logger.warning(
                "task_reconciled_as_orphaned", task_id=str(task.id), status=task.status,
                stale_since=task.updated_at.isoformat(),
            )
            await _mark_failed(
                session, task,
                "Task appears orphaned — no progress for over "
                f"{get_settings().task_timeout_seconds + ORPHAN_GRACE_SECONDS}s, likely lost when "
                "a worker process restarted or crashed mid-execution. Please retry.",
                agent=agent,
            )
