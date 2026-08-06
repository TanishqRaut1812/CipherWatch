import pytest
from backend.analytics.baseline_engine import BaselineEngine


def test_baseline_stats_calculation():
    """Verify mean and standard deviation computation."""
    engine = BaselineEngine()
    data = [100.0, 200.0, 300.0, 400.0, 500.0]
    mean, std_dev = engine.calculate_baseline_stats(data)

    assert mean == 300.0
    assert round(std_dev, 2) == 158.11


def test_baseline_stats_single_or_empty():
    """Verify handling of single or empty data points."""
    engine = BaselineEngine()
    mean, std_dev = engine.calculate_baseline_stats([50.0])
    assert mean == 50.0
    assert std_dev == 1.0

    mean_empty, std_dev_empty = engine.calculate_baseline_stats([])
    assert mean_empty == 0.0
    assert std_dev_empty == 1.0


def test_z_score_computation():
    """Verify z-score metric calculation."""
    engine = BaselineEngine()
    z = engine.compute_z_score(current_value=450.0, mean=300.0, std_dev=50.0)
    assert z == 3.0


def test_z_score_to_risk_modifier_mapping():
    """Verify mapping z-score deviations to risk score bonuses."""
    engine = BaselineEngine()

    assert engine.z_score_to_risk_modifier(-0.5) == 0.0
    assert engine.z_score_to_risk_modifier(0.5) == 0.05
    assert engine.z_score_to_risk_modifier(1.5) == 0.15
    assert engine.z_score_to_risk_modifier(2.5) == 0.25
    assert engine.z_score_to_risk_modifier(4.0) == 0.35
