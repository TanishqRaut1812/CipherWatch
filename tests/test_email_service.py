from unittest.mock import MagicMock, patch
from backend.services.email_service import generate_threat_alert_html, send_high_threat_alert_email


def test_generate_threat_alert_html():
    """Verify HTML template rendering with critical alert parameters."""
    html = generate_threat_alert_html(
        admin_email="admin@company.com",
        org_name="HACKIT",
        device_name="Workstation-Alpha",
        hostname="DESKTOP-CYPH01",
        severity="CRITICAL",
        rule_id="FS_RAPID_BURST",
        risk_score=0.92,
        message="Mass filesystem modifications detected in single batch.",
    )

    assert "CRITICAL ALERT" in html
    assert "HACKIT" in html
    assert "DESKTOP-CYPH01" in html
    assert "FS_RAPID_BURST" in html
    assert "92%" in html
    assert "Open Incident in Dashboard" in html


@patch("backend.services.email_service.httpx.Client")
@patch("backend.services.email_service.settings")
def test_send_high_threat_alert_email_success(mock_settings, mock_httpx_client):
    """Verify Resend HTTP POST request structure on high threat trigger."""
    mock_settings.RESEND_API_KEY = "re_test_key_123"
    mock_settings.SENDER_EMAIL = "alerts@cipherwatch.com"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = '{"id": "msg_123"}'

    client_instance = MagicMock()
    client_instance.post.return_value = mock_resp
    client_instance.__enter__.return_value = client_instance
    mock_httpx_client.return_value = client_instance

    success = send_high_threat_alert_email(
        admin_email="soc-admin@hacker.io",
        org_name="HACKIT",
        device_name="Prod-Server",
        hostname="srv-01",
        severity="CRITICAL",
        rule_id="PROC_SUSPICIOUS_PATH",
        risk_score=0.88,
        message="Suspicious binary spawned from /tmp",
    )

    assert success is True
    client_instance.post.assert_called_once()
    call_args = client_instance.post.call_args
    assert call_args[0][0] == "https://api.resend.com/emails"
    assert call_args[1]["headers"]["Authorization"] == "Bearer re_test_key_123"
    assert call_args[1]["json"]["to"] == ["soc-admin@hacker.io"]
    assert "CRITICAL THREAT DETECTED" in call_args[1]["json"]["subject"]


def test_sent_emails_log_tracking():
    """Verify dispatched emails are recorded in notification log."""
    from backend.services.email_service import get_sent_emails_log, SENT_EMAILS_LOG
    initial_count = len(SENT_EMAILS_LOG)

    send_high_threat_alert_email(
        admin_email="test-log@company.com",
        org_name="LogOrg",
        device_name="DevBox",
        hostname="log-host-01",
        severity="CRITICAL",
        rule_id="TEST_RULE",
        risk_score=0.99,
        message="Logging test dispatch.",
    )

    logs = get_sent_emails_log()
    assert len(logs) == initial_count + 1
    latest = logs[0]
    assert latest["admin_email"] == "test-log@company.com"
    assert latest["severity"] == "CRITICAL"
    assert "CRITICAL ALERT" in latest["html_content"]

