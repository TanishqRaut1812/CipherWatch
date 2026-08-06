import pytest
from simulator.scenarios import get_scenario_normal_day, get_scenario_bulk_exfiltration, get_scenario_slow_drip
from simulator.injector import EventInjector


def test_scenarios_structure():
    """Verify scenarios generate valid event lists."""
    normal = get_scenario_normal_day()
    assert len(normal) == 4
    assert normal[0]["event_type"] == "FILE_OPEN"

    bulk = get_scenario_bulk_exfiltration()
    assert len(bulk) == 4
    assert any(e["event_type"] == "USB_INSERT" for e in bulk)

    slow = get_scenario_slow_drip()
    assert len(slow) == 8


def test_injector_post_event_offline():
    """Verify injector handles connection gracefully when backend server is offline."""
    injector = EventInjector(api_url="http://127.0.0.1:59999/api/events")
    event = get_scenario_normal_day()[0]
    res = injector.post_event(event)
    assert res is None
