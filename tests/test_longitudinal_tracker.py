from datetime import datetime, timedelta, timezone
import pytest
from backend.analytics.longitudinal_tracker import LongitudinalTracker


def test_longitudinal_tracker_initial_state():
    tracker = LongitudinalTracker(window_days=14)
    summary = tracker.get_user_summary("user_test_01")
    assert summary["total_bytes"] == 0
    assert tracker.compute_longitudinal_risk_score("user_test_01") == 0.0


def test_longitudinal_tracker_single_day_activity():
    tracker = LongitudinalTracker(window_days=14)
    now = datetime.now(timezone.utc)

    tracker.record_activity(
        user_id="user_test_02",
        timestamp=now,
        bytes_transferred=10 * 1024 * 1024,  # 10 MB
        destination_type="usb",
        event_type="FILE_CREATE",
    )

    summary = tracker.get_user_summary("user_test_02")
    assert summary["usb_bytes"] == 10 * 1024 * 1024
    assert summary["total_events"] == 1
    # 10MB USB is under 25MB threshold so risk score is 0.0
    assert tracker.compute_longitudinal_risk_score("user_test_02") == 0.0


def test_longitudinal_tracker_slow_drip_detection():
    tracker = LongitudinalTracker(window_days=14)
    now = datetime.now(timezone.utc)

    # Simulate slow-drip over 4 consecutive days (10 MB per day USB transfer)
    for day_offset in range(4):
        event_time = now - timedelta(days=day_offset)
        tracker.record_activity(
            user_id="user_slow_drip",
            timestamp=event_time,
            bytes_transferred=10 * 1024 * 1024,  # 10 MB/day = 40 MB total (> 25MB threshold)
            destination_type="usb",
            event_type="FILE_CREATE",
        )

    summary = tracker.get_user_summary("user_slow_drip")
    assert summary["usb_bytes"] == 40 * 1024 * 1024
    assert summary["active_days"] == 4

    risk_score = tracker.compute_longitudinal_risk_score("user_slow_drip")
    # 40MB total exfil (>25MB gives 0.15) + 4 exfil days (>=3 days gives 0.20) = 0.35
    assert risk_score >= 0.35


def test_longitudinal_tracker_high_volume_exfiltration():
    tracker = LongitudinalTracker(window_days=14)
    now = datetime.now(timezone.utc)

    # Simulate massive exfiltration (> 500 MB) across 6 days
    for day_offset in range(6):
        event_time = now - timedelta(days=day_offset)
        tracker.record_activity(
            user_id="user_insider_threat",
            timestamp=event_time,
            bytes_transferred=100 * 1024 * 1024,  # 100 MB/day = 600 MB total
            destination_type="cloud",
            event_type="FILE_CREATE",
        )

    risk_score = tracker.compute_longitudinal_risk_score("user_insider_threat")
    # 600MB (>500MB gives 0.50) + 6 exfil days (>=5 days gives 0.35) = 0.85
    assert risk_score >= 0.85
