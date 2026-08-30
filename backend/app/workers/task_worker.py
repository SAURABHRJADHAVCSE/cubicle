"""Celery tasks: execute a Task against its assigned agent's engine, or
route it through a boss/orchestrator agent into subtasks first."""

import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import worker_session_factory
from app.engines.registry import get_engine
from app.models.agent import Agent
from app.models.task import Task
from app.utils.inbox import format_inbox_context, read_and_archive_inbox, write_delegation_notice
from app.utils.push import notify_all_devices
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
    """If `task` was a boss-routed child and every sibling sharing its
    parent_task_id has now reached a terminal state, aggregate their
    results into the parent and mark it completed/failed too.

    route_task() dispatches children independently, so nothing previously
    observed "all children are done" — a routed task's parent just sat in
    "routed" forever. Called from both terminal paths a task can reach
    (the success tail of _execute_task_async, and _mark_failed), since a
    child can finish either way.
    """
    if task.parent_task_id is None:
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

    parent = await session.get(Task, task.parent_task_id)
    if parent is None or parent.status in ("completed", "failed"):
        # Already aggregated (or the parent's gone) — best-effort guard
        # against two siblings finishing concurrently on different workers
        # both observing "all done" before either commits. Worst case of
        # that race is a second, harmless emit, not corrupted data, given
        # how few subtasks a routed task realistically has.
        return

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
    """Load the task and its agent, run the engine, and persist the result."""
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
            result = await engine.execute(
                inbox_context + task.brief,
                context={
                    "system_prompt": f"You are {agent.name}, a {agent.role}.",
                    "working_dir": agent.working_directory,
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
    whole brief to the orchestrator itself if decomposition fails."""
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
            result = await engine.execute(
                prompt,
                context={
                    "system_prompt": (
                        f"You are {orchestrator.name}, a {orchestrator.role} who manages a team."
                    ),
                },
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
