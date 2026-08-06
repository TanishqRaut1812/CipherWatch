import pytest
from backend.analytics.risk_scorer import HybridRiskScorer


def test_hybrid_risk_scorer_clean_session():
    scorer = HybridRiskScorer()
    session_payload = {
        "user_id": "user_clean",
        "session_id": "sess_clean_01",
        "events": [
            {
                "event_type": "PROCESS_LAUNCH",
                "timestamp": "2026-08-01T10:00:00Z",
                "metadata": {"process_name": "chrome.exe"},
            }
        ],
    }

    result = scorer.compute_hybrid_risk_score(session_payload, ml_anomaly_score=0.0)

    assert "risk_score" in result
    assert "breakdown" in result
    assert result["risk_score"] < 25.0
    assert result["breakdown"]["folder_sensitivity"] == 0.0


def test_hybrid_risk_scorer_high_risk_session():
    scorer = HybridRiskScorer()
    session_payload = {
        "user_id": "user_malicious",
        "session_id": "sess_high_risk",
        "events": [
            {
                "event_type": "FILE_CREATE",
                "timestamp": "2026-08-01T23:30:00Z",  # Off-hours
                "metadata": {
                    "extension": ".7z",
                    "is_encrypted_archive": True,
                    "file_path": "/home/user/finance/secret_payroll.7z",  # Sensitive folder keyword
                    "file_size_bytes": 50000000,
                },
            },
            {
                "event_type": "USB_INSERT",
                "timestamp": "2026-08-01T23:32:00Z",
                "metadata": {"vendor_id": "0x0781", "mount_point": "USB_STICK"},
            },
            {
                "event_type": "NETWORK_CONNECTION",
                "timestamp": "2026-08-01T23:35:00Z",
                "metadata": {"destination_host": "dropfile.io"},
            },
        ],
    }

    result = scorer.compute_hybrid_risk_score(
        session_payload=session_payload,
        ml_anomaly_score=0.85,
        historical_metric_values=[1.0, 2.0, 1.0],
        longitudinal_drift_score=0.80,
    )

    assert result["risk_score"] > 60.0
    bd = result["breakdown"]
    assert bd["isolation_forest_ml"] > 0.0
    assert bd["rule_heuristics"] > 0.0
    assert bd["folder_sensitivity"] == 2.5  # 0.25 * 10.0
    assert bd["graph_topology"] > 0.0
    assert bd["longitudinal_drift"] == 8.0  # 0.80 * 10.0
    assert result["topology_multiplier"] == 1.50
