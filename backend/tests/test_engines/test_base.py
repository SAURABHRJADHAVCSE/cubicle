"""Tests for the EngineResult schema's defaults."""

from app.engines.base import EngineResult


def test_engine_result_defaults() -> None:
    result = EngineResult(output="hello")

    assert result.structured is None
    assert result.files_changed == []
    assert result.tokens_used == 0
    assert result.cost_usd == 0.0
    assert result.raw_output is None
