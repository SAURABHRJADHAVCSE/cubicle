"""SQLAlchemy models package.

Every model module must be imported here so that ``Base.metadata`` (and
therefore Alembic's autogenerate) sees every table regardless of import
order elsewhere in the app.
"""

from app.models.agent import Agent
from app.models.settings import SettingRecord
from app.models.task import Task

__all__ = ["Agent", "SettingRecord", "Task"]
