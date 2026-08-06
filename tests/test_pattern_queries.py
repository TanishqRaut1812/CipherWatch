import pytest
from backend.graph.session_graph import SessionGraphBuilder
from backend.graph.pattern_queries import GraphPatternQueryEngine


def test_triple_exfiltration_chain_pattern_match():
    builder = SessionGraphBuilder()
    session_payload = {
        "user_id": "user_exfil_target",
        "device_id": "MAC-WORKSTATION-01",
        "session_id": "sess_triple_exfil",
        "events": [
            {
                "event_type": "FILE_CREATE",
                "metadata": {"extension": ".7z", "is_encrypted_archive": True, "file_name": "passwords.7z"},
            },
            {
                "event_type": "USB_INSERT",
                "metadata": {"vendor_id": "0x0781", "mount_point": "SECURE_USB"},
            },
            {
                "event_type": "NETWORK_CONNECTION",
                "metadata": {"destination_host": "api.megaupload.com"},
            },
        ],
    }

    g = builder.build_from_session_payload(session_payload)
    query_engine = GraphPatternQueryEngine()

    result = query_engine.evaluate_graph_patterns(g)

    assert result["score_multiplier"] == 1.50
    assert result["pattern_risk_score"] == 1.0
    assert any("TRIPLE_EXFILTRATION_CHAIN" in p for p in result["matched_patterns"])


def test_staged_archive_pattern_match():
    builder = SessionGraphBuilder()
    session_payload = {
        "user_id": "user_staged",
        "device_id": "WIN-WORKSTATION-02",
        "session_id": "sess_staged_archive",
        "events": [
            {
                "event_type": "FILE_CREATE",
                "metadata": {"extension": ".zip", "is_encrypted_archive": True, "file_name": "data.zip"},
            },
            {
                "event_type": "NETWORK_CONNECTION",
                "metadata": {"destination_host": "dropbox.com"},
            },
        ],
    }

    g = builder.build_from_session_payload(session_payload)
    query_engine = GraphPatternQueryEngine()

    result = query_engine.evaluate_graph_patterns(g)

    assert result["score_multiplier"] == 1.30
    assert any("STAGED_ARCHIVE_EXFILTRATION" in p for p in result["matched_patterns"])


def test_clean_session_no_pattern_match():
    builder = SessionGraphBuilder()
    session_payload = {
        "user_id": "user_normal",
        "device_id": "DEV-01",
        "session_id": "sess_normal",
        "events": [
            {
                "event_type": "PROCESS_LAUNCH",
                "metadata": {"process_name": "vscode.exe"},
            },
            {
                "event_type": "FILE_CREATE",
                "metadata": {"extension": ".py", "file_name": "main.py"},
            },
        ],
    }

    g = builder.build_from_session_payload(session_payload)
    query_engine = GraphPatternQueryEngine()

    result = query_engine.evaluate_graph_patterns(g)

    assert result["score_multiplier"] == 1.0
    assert result["pattern_risk_score"] == 0.0
    assert len(result["matched_patterns"]) == 0
