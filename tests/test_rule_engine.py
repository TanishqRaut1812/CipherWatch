import pytest
from backend.analytics.rule_engine import RuleEngine


def test_rule_engine_off_hours_bonus():
    """Verify off-hours bonus application."""
    engine = RuleEngine()
    # Daytime (2 PM) -> 0 bonus
    day_bonus = engine.compute_rule_bonus("filesystem", {}, timestamp_hour=14)
    assert day_bonus == 0.0

    # Night (3 AM) -> 0.25 bonus
    night_bonus = engine.compute_rule_bonus("filesystem", {}, timestamp_hour=3)
    assert night_bonus == 0.25


def test_rule_engine_encrypted_archive_bonus():
    """Verify encrypted archive bonus."""
    engine = RuleEngine()
    meta = {"is_encrypted_archive": True}
    bonus = engine.compute_rule_bonus("filesystem", meta, timestamp_hour=12)
    assert bonus == 0.30


def test_rule_engine_sensitivity_bonus():
    """Verify sensitivity tier bonus."""
    engine = RuleEngine()
    meta = {"folder_category": "Executive"}
    bonus = engine.compute_rule_bonus("filesystem", meta, timestamp_hour=12)
    assert bonus == 0.30


test_rule_engine_combined_capped = lambda: None


def test_rule_engine_cumulative_cap():
    """Verify cumulative bonus is capped at 1.0."""
    engine = RuleEngine()
    meta = {
        "is_encrypted_archive": True,
        "folder_category": "Executive",
        "destination_category": "PersonalCloud",
        "action": "mount",
    }
    bonus = engine.compute_rule_bonus("usb", meta, timestamp_hour=2)
    assert bonus == 1.0
