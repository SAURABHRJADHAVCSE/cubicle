"""Shared helper for anchoring an agent's system prompt to the real date.

Without this, a model falls back to guessing "today" from patterns in its
training data — confirmed live: the same agent, in the same call, guessed
2020 and then 2023 when asked, both wrong (the real date was 2026). Every
system prompt that talks to a model on the agent's behalf should include
this line.
"""

from datetime import datetime, timezone


def current_date_line() -> str:
    return f"Today's date is {datetime.now(timezone.utc):%A, %B %d, %Y} (UTC)."
