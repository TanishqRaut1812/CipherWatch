from datetime import datetime
from typing import Optional
import httpx
from backend.config import settings
from backend.logging_config import logger


def generate_threat_alert_html(
    admin_email: str,
    org_name: str,
    device_name: str,
    hostname: str,
    severity: str,
    rule_id: str,
    risk_score: float,
    message: str,
    alert_time: Optional[str] = None,
) -> str:
    """Generate a high-fidelity, SOC-grade HTML email template for critical threat alerts."""
    formatted_time = alert_time or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    sev_upper = severity.upper()
    
    # Theme color scheme based on threat severity
    if sev_upper in ("CRITICAL", "HIGH"):
        accent_color = "#ff2a5f"
        accent_bg = "#3a0e1c"
        badge_border = "#ff2a5f"
        glow_color = "rgba(255, 42, 95, 0.4)"
    else:
        accent_color = "#f59e0b"
        accent_bg = "#342207"
        badge_border = "#f59e0b"
        glow_color = "rgba(245, 158, 11, 0.4)"

    score_pct = int(risk_score * 100) if risk_score <= 1.0 else int(risk_score)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Alert - CipherWatch</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; color: #e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="640px" cellspacing="0" cellpadding="0" style="max-width: 640px; background-color: #111827; border: 1px solid #1f293d; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #111827 0%, #1e1b4b 100%); padding: 32px 40px; border-bottom: 1px solid #1f293d; text-align: left;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; background-color: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 700; color: #818cf8; letter-spacing: 1.5px; text-transform: uppercase;">
                      CipherWatch Threat Engine
                    </div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 6px 14px; background-color: {accent_bg}; border: 1px solid {badge_border}; border-radius: 20px; color: {accent_color}; font-size: 12px; font-weight: 800; letter-spacing: 1px; box-shadow: 0 0 12px {glow_color};">
                      🚨 {sev_upper} ALERT
                    </span>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 20px 0 8px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                High Threat Risk Detected
              </h1>
              <p style="margin: 0; font-size: 14px; color: #94a3b8;">
                Anomalous security behavior requiring immediate administrative attention.
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 40px;">
              
              <!-- Target Spec Grid -->
              <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px; background-color: #0d1322; border: 1px solid #1e293b; border-radius: 12px; padding: 20px;">
                <tr>
                  <td width="50%" style="padding: 8px 12px; vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Organization</div>
                    <div style="font-size: 15px; color: #f8fafc; font-weight: 600; margin-top: 4px;">{org_name}</div>
                  </td>
                  <td width="50%" style="padding: 8px 12px; vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Device / Hostname</div>
                    <div style="font-size: 15px; color: #38bdf8; font-weight: 600; margin-top: 4px;">{device_name} ({hostname})</div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding: 8px 12px; vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Rule Triggered</div>
                    <div style="font-size: 14px; color: #cbd5e1; font-weight: 600; margin-top: 4px;">{rule_id or 'BEHAVIORAL_ANOMALY'}</div>
                  </td>
                  <td width="50%" style="padding: 8px 12px; vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Calculated Risk Score</div>
                    <div style="font-size: 16px; color: {accent_color}; font-weight: 800; margin-top: 4px;">{score_pct}% ({risk_score:.2f})</div>
                  </td>
                </tr>
              </table>

              <!-- Alert Details Box -->
              <div style="margin-bottom: 28px; background-color: rgba(15, 23, 42, 0.8); border-left: 4px solid {accent_color}; border-radius: 4px 12px 12px 4px; padding: 20px;">
                <div style="font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">
                  Detection Details
                </div>
                <div style="font-size: 14px; color: #f1f5f9; line-height: 1.6;">
                  {message}
                </div>
              </div>

              <!-- Recommended Action Plan -->
              <div style="margin-bottom: 32px;">
                <h3 style="font-size: 14px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                  Recommended SOC Action Protocol
                </h3>
                <table width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #cbd5e1;">
                      <span style="color: {accent_color}; font-weight: 700; margin-right: 8px;">1.</span> Review suspicious process logs on host <b>{hostname}</b>.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #cbd5e1;">
                      <span style="color: {accent_color}; font-weight: 700; margin-right: 8px;">2.</span> Verify active user session token and isolate endpoint if unverified.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #cbd5e1;">
                      <span style="color: {accent_color}; font-weight: 700; margin-right: 8px;">3.</span> Log in to CipherWatch Dashboard to acknowledge or dismiss alert.
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 36px 0 16px 0;">
                <a href="http://localhost:5173" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);">
                  Open Incident in Dashboard &rarr;
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0d1322; padding: 24px 40px; border-top: 1px solid #1e293b; text-align: center; font-size: 12px; color: #64748b;">
              <p style="margin: 0 0 6px 0;">
                CipherWatch Endpoint Detection & Response • Privacy-Preserving Security Engine
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                Alert Timestamp: {formatted_time} • System Generated Email
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


import time

# In-memory record store for sent/generated email notifications
SENT_EMAILS_LOG = []


def get_sent_emails_log():
    """Retrieve all recorded email notifications ordered by newest first."""
    return sorted(SENT_EMAILS_LOG, key=lambda x: x.get("timestamp", 0), reverse=True)


def send_high_threat_alert_email(
    admin_email: str,
    org_name: str,
    device_name: str,
    hostname: str,
    severity: str,
    rule_id: str,
    risk_score: float,
    message: str,
    alert_time: Optional[str] = None,
) -> bool:
    """Send high threat alert email via Resend API and log to notification engine."""
    api_key = settings.RESEND_API_KEY
    sender = settings.SENDER_EMAIL or "CipherWatch Security <onboarding@resend.dev>"
    subject = f"🚨 [{severity.upper()} THREAT DETECTED] Host '{hostname}' in {org_name}"
    formatted_time = alert_time or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    html_content = generate_threat_alert_html(
        admin_email=admin_email,
        org_name=org_name,
        device_name=device_name,
        hostname=hostname,
        severity=severity,
        rule_id=rule_id,
        risk_score=risk_score,
        message=message,
        alert_time=formatted_time,
    )

    mail_entry = {
        "id": f"mail_{len(SENT_EMAILS_LOG) + 1}_{int(time.time())}",
        "admin_email": admin_email,
        "org_name": org_name,
        "device_name": device_name,
        "hostname": hostname,
        "severity": severity,
        "rule_id": rule_id,
        "risk_score": risk_score,
        "message": message,
        "subject": subject,
        "sent_at": formatted_time,
        "timestamp": time.time(),
        "status": "SENT" if api_key else "DISPATCHED (DEMO)",
        "html_content": html_content,
        "read": False,
    }
    SENT_EMAILS_LOG.append(mail_entry)

    if not api_key:
        logger.warning(
            "Resend email dispatch skipped: RESEND_API_KEY is not set. Notification recorded in header activity feed for {}.",
            hostname,
        )
        return True

    payload = {
        "from": sender,
        "to": [admin_email],
        "subject": subject,
        "html": html_content,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post("https://api.resend.com/emails", json=payload, headers=headers)
            if resp.status_code in (200, 201):
                logger.info(
                    "Resend threat email sent successfully to {} for org '{}' (host: {})",
                    admin_email,
                    org_name,
                    hostname,
                )
                mail_entry["status"] = "SENT_RESEND"
                return True
            else:
                logger.error(
                    "Failed to send Resend email: status={}, response={}",
                    resp.status_code,
                    resp.text,
                )
                mail_entry["status"] = "FAILED"
                return False
    except Exception as e:
        logger.error("Exception occurred while sending Resend threat alert email to {}: {}", admin_email, e)
        mail_entry["status"] = "FAILED"
        return False
