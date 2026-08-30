"""SQLAlchemy models package.

Every model module must be imported here so that ``Base.metadata`` (and
therefore Alembic's autogenerate) sees every table regardless of import
order elsewhere in the app.
"""

from app.models.agent import Agent
from app.models.agent_collaborator import AgentCollaborator
from app.models.conversation import Conversation
from app.models.device import Device
from app.models.memory import AgentMemory
from app.models.settings import SettingRecord
from app.models.task import Task

__all__ = [
    "Agent",
    "AgentCollaborator",
    "AgentMemory",
    "Conversation",
    "Device",
    "SettingRecord",
    "Task",
]
