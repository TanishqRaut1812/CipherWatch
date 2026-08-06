import pytest
from backend.analytics.intent_classifier import IntentClassifier


def test_routine_workspace_activity():
    """Verify normal workspace events return Routine Workspace Activity label."""
    classifier = IntentClassifier()
    events = [
        {"event_type": "filesystem", "metadata": {"folder_category": "General", "extension": ".txt"}},
        {"event_type": "process", "metadata": {"process_name": "code"}},
    ]

    intent, confidence = classifier.classify_session_intent(events)
    assert intent == IntentClassifier.ROUTINE_ACTIVITY
    assert 0.0 <= confidence <= 1.0


def test_usb_exfiltration_intent():
    """Verify sensitive file access with archiving and USB mount yields USB Exfiltration Staging."""
    classifier = IntentClassifier()
    events = [
        {"event_type": "filesystem", "metadata": {"folder_category": "Finance", "extension": ".xlsx"}},
        {"event_type": "filesystem", "metadata": {"folder_category": "Finance", "extension": ".zip", "is_encrypted_archive": True}},
        {"event_type": "usb", "metadata": {"action": "mount", "mount_point": "/media/usb0"}},
    ]

    intent, confidence = classifier.classify_session_intent(events)
    assert intent == IntentClassifier.USB_EXFILTRATION
    assert confidence >= 0.90


def test_cloud_exfiltration_intent():
    """Verify sensitive file access with archiving and personal cloud upload yields Cloud Exfiltration Staging."""
    classifier = IntentClassifier()
    events = [
        {"event_type": "filesystem", "metadata": {"folder_category": "Executive", "extension": ".pdf"}},
        {"event_type": "filesystem", "metadata": {"folder_category": "Executive", "extension": ".7z", "is_encrypted_archive": True}},
        {"event_type": "network", "metadata": {"destination_category": "personal_cloud"}},
    ]

    intent, confidence = classifier.classify_session_intent(events)
    assert intent == IntentClassifier.CLOUD_EXFILTRATION
    assert confidence >= 0.90


def test_screen_clipboard_harvesting_intent():
    """Verify screenshot and clipboard burst events yield Screen Capture & Clipboard Harvesting."""
    classifier = IntentClassifier()
    events = [
        {"event_type": "screenshot_event", "metadata": {"capture_count": 5}},
        {"event_type": "clipboard_burst", "metadata": {"copy_count": 20}},
        {"event_type": "usb", "metadata": {"action": "connected"}},
    ]

    intent, confidence = classifier.classify_session_intent(events)
    assert intent == IntentClassifier.SCREEN_CLIPBOARD_HARVESTING
    assert confidence >= 0.80
