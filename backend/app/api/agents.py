"""Agent CRUD API routes."""

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentRead, AgentUpdate

logger = structlog.get_logger()

router = APIRouter(prefix="/agents", tags=["agents"])


async def _get_agent_or_404(agent_id: uuid.UUID, db: AsyncSession) -> Agent:
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
async def create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db)) -> Agent:
    """Create a new agent."""
    agent = Agent(**payload.model_dump())
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    logger.info("agent_created", agent_id=str(agent.id), name=agent.name)
    return agent


@router.get("", response_model=list[AgentRead])
async def list_agents(db: AsyncSession = Depends(get_db)) -> list[Agent]:
    """List all agents."""
    result = await db.execute(select(Agent).order_by(Agent.created_at))
    return list(result.scalars().all())


@router.get("/{agent_id}", response_model=AgentRead)
async def get_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Agent:
    """Fetch a single agent by id."""
    return await _get_agent_or_404(agent_id, db)


@router.patch("/{agent_id}", response_model=AgentRead)
async def update_agent(
    agent_id: uuid.UUID, payload: AgentUpdate, db: AsyncSession = Depends(get_db)
) -> Agent:
    """Partially update an agent."""
    agent = await _get_agent_or_404(agent_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    await db.commit()
    await db.refresh(agent)
    logger.info("agent_updated", agent_id=str(agent.id))
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Delete an agent."""
    agent = await _get_agent_or_404(agent_id, db)
    await db.delete(agent)
    await db.commit()
    logger.info("agent_deleted", agent_id=str(agent_id))
