import pytest
from backend.analytics.graph_engine import GraphEngine


def test_build_session_graph():
    """Verify GraphEngine constructs valid NetworkX DiGraph with sequential edges."""
    engine = GraphEngine()
    events = [
        {"event_type": "filesystem", "metadata": {"folder_category": "General"}},
        {"event_type": "process", "metadata": {"process_name": "zip.exe"}},
        {"event_type": "network", "metadata": {"destination_category": "personal_cloud"}},
    ]

    graph = engine.build_session_graph(events)
    assert graph.number_of_nodes() == 3
    assert graph.number_of_edges() == 2
    assert "event_0_filesystem" in graph.nodes
    assert "event_2_network" in graph.nodes


def test_detect_exfiltration_paths_benign():
    """Verify single or harmless event sequences return zero risk score."""
    engine = GraphEngine()
    events = [
        {"event_type": "filesystem", "metadata": {"folder_category": "General", "extension": ".txt"}},
    ]

    score, patterns = engine.detect_exfiltration_paths(events)
    assert score == 0.0
    assert len(patterns) == 0


def test_detect_full_exfiltration_chain():
    """Verify sensitive file -> archive -> external outlet sequence triggers full exfiltration chain pattern."""
    engine = GraphEngine()
    events = [
        {"event_type": "filesystem", "metadata": {"folder_category": "Finance", "extension": ".pdf"}},
        {"event_type": "filesystem", "metadata": {"folder_category": "Finance", "extension": ".zip", "is_encrypted_archive": True}},
        {"event_type": "usb", "metadata": {"action": "mount", "mount_point": "/media/usb0"}},
    ]

    score, patterns = engine.detect_exfiltration_paths(events)
    assert score >= 0.85
    assert len(patterns) >= 1
    assert "FULL_EXFILTRATION_CHAIN" in patterns[0]


def test_score_bounding():
    """Verify graph pattern risk score is strictly bounded in [0.0, 1.0]."""
    engine = GraphEngine()
    events = [
        {"event_type": "filesystem", "metadata": {"folder_category": "Executive", "extension": ".docx"}},
        {"event_type": "filesystem", "metadata": {"folder_category": "Executive", "extension": ".7z", "is_encrypted_archive": True}},
        {"event_type": "network", "metadata": {"destination_category": "personal_cloud"}},
        {"event_type": "screenshot_event", "metadata": {"capture_count": 5}},
    ]

    score, patterns = engine.detect_exfiltration_paths(events)
    assert 0.0 <= score <= 1.0
