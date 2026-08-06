import pytest
from agent.config import AgentConfig
from agent.monitors.privacy_toggles import PrivacyToggleMonitor


def test_privacy_toggles_disabled_by_default():
    """Verify screenshot and clipboard monitors are disabled by default."""
    config = AgentConfig()
    assert config.enable_screenshot_event_monitor is False
    assert config.enable_clipboard_burst_monitor is False

    monitor = PrivacyToggleMonitor(config=config)
    assert monitor.record_screenshot_event() is None
    assert monitor.record_clipboard_burst(copy_count=10) is None


def test_privacy_toggles_enabled_metadata_only():
    """Verify enabling toggles records metadata flags without capturing image/text content."""
    config = AgentConfig(
        enable_screenshot_event_monitor=True,
        enable_clipboard_burst_monitor=True,
    )
    monitor = PrivacyToggleMonitor(config=config)

    shot_event = monitor.record_screenshot_event(display_id="MAIN_DISP")
    assert shot_event is not None
    assert shot_event["event_type"] == "SCREENSHOT_TAKEN"
    assert shot_event["metadata"]["pixel_content_captured"] is False

    clip_event = monitor.record_clipboard_burst(copy_count=15)
    assert clip_event is not None
    assert clip_event["event_type"] == "CLIPBOARD_BURST"
    assert clip_event["metadata"]["text_content_captured"] is False
    assert clip_event["metadata"]["copy_event_count"] == 15
