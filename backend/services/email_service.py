from datetime import datetime
import time
from typing import Optional, Dict, Any, Tuple
import httpx
from backend.config import settings
from backend.logging_config import logger

# In-memory record store for sent/generated email notifications
SENT_EMAILS_LOG = []


def get_sent_emails_log():
    """Retrieve all recorded email notifications ordered by newest first (strictly CRITICAL)."""
    critical_logs = [x for x in SENT_EMAILS_LOG if (x.get("severity") or "").upper() == "CRITICAL"]
    return sorted(critical_logs, key=lambda x: x.get("timestamp", 0), reverse=True)


def _send_resend_http_request(payload: Dict[str, Any]) -> Tuple[bool, str, int]:
    """Execute HTTP POST request to Resend API.
    
    Returns (success: bool, response_text: str, status_code: int).
    """
    api_key = settings.RESEND_API_KEY
    if not api_key:
        logger.warning("Resend API dispatch skipped: RESEND_API_KEY is not configured.")
        return True, "DISPATCH_SKIPPED_NO_API_KEY", 200

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post("https://api.resend.com/emails", json=payload, headers=headers)
            if resp.status_code in (200, 201):
                return True, resp.text, resp.status_code
            else:
                logger.error("Resend API HTTP Error: status={}, response={}", resp.status_code, resp.text)
                return False, resp.text, resp.status_code
    except Exception as e:
        logger.error("Exception during Resend API call: {}", str(e))
        return False, str(e), 500


# ---------------------------------------------------------------------------
# REUSABLE EMAIL HTML TEMPLATE GENERATORS (SHARED SOC BRANDING)
# ---------------------------------------------------------------------------


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
    affected_user: Optional[str] = None,
    confidence: Optional[str] = None,
) -> str:
    """Generate a high-fidelity, SOC-grade HTML email template for critical threat alerts."""
    formatted_time = alert_time or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    sev_upper = severity.upper()

    accent_color = "#ff2a5f" if sev_upper in ("CRITICAL", "HIGH") else "#f59e0b"
    accent_bg = "#3a0e1c" if sev_upper in ("CRITICAL", "HIGH") else "#342207"
    badge_border = "#ff2a5f" if sev_upper in ("CRITICAL", "HIGH") else "#f59e0b"
    glow_color = "rgba(255, 42, 95, 0.4)" if sev_upper in ("CRITICAL", "HIGH") else "rgba(245, 158, 11, 0.4)"

    score_pct = int(risk_score * 100) if risk_score <= 1.0 else int(risk_score)
    user_str = affected_user or admin_email

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
                Critical Threat Incident Detected
              </h1>
              <p style="margin: 0; font-size: 14px; color: #94a3b8;">
                Anomalous security telemetry requiring immediate SOC intervention.
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
                    <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Rule / Threat Category</div>
                    <div style="font-size: 14px; color: #cbd5e1; font-weight: 600; margin-top: 4px;">{rule_id}</div>
                  </td>
                  <td width="50%" style="padding: 8px 12px; vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Calculated Risk Score</div>
                    <div style="font-size: 16px; color: {accent_color}; font-weight: 800; margin-top: 4px;">{score_pct}% ({risk_score:.2f}){f' • Conf: {confidence}' if confidence else ''}</div>
                  </td>
                </tr>
                <tr>
                  <td width="100%" colspan="2" style="padding: 8px 12px; vertical-align: top; border-top: 1px solid #1e293b; margin-top: 8px;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Affected User / Identity</div>
                    <div style="font-size: 14px; color: #fcd535; font-weight: 700; margin-top: 4px;">{user_str}</div>
                  </td>
                </tr>
              </table>

              <!-- Alert Details Box -->
              <div style="margin-bottom: 28px; background-color: rgba(15, 23, 42, 0.8); border-left: 4px solid {accent_color}; border-radius: 4px 12px 12px 4px; padding: 20px;">
                <div style="font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">
                  Incident Summary
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
                      <span style="color: {accent_color}; font-weight: 700; margin-right: 8px;">1.</span> Review active telemetry process stream on host <b>{hostname}</b>.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #cbd5e1;">
                      <span style="color: {accent_color}; font-weight: 700; margin-right: 8px;">2.</span> Verify user credentials for <b>{user_str}</b> and isolate host if unauthorized.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #cbd5e1;">
                      <span style="color: {accent_color}; font-weight: 700; margin-right: 8px;">3.</span> Log in to CipherWatch Dashboard to acknowledge or dismiss threat alert.
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
                Alert Timestamp: {formatted_time} • Automated SOC Dispatch
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


def generate_auth_otp_html(
    org_name: str,
    user_email: str,
    otp_code: str,
    title: str = "CipherWatch Verification Code",
    subtitle: str = "Two-Factor Authentication Request",
    expiry_minutes: int = 10,
    device_or_ip: Optional[str] = None,
) -> str:
    """Generate a clean, reusable HTML email template for Authentication OTPs (Forgot Password & 2FA)."""
    formatted_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} - CipherWatch</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; color: #e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="540px" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #111827; border: 1px solid #1f293d; border-radius: 14px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #111827 0%, #1e1b4b 100%); padding: 28px 36px; border-bottom: 1px solid #1f293d; text-align: left;">
              <div style="display: inline-block; background-color: rgba(252, 213, 53, 0.15); border: 1px solid rgba(252, 213, 53, 0.3); border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 800; color: #fcd535; letter-spacing: 1.2px; text-transform: uppercase;">
                CIPHERWATCH SECURITY PORTAL
              </div>
              <h2 style="margin: 16px 0 6px 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px;">
                {title}
              </h2>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                {subtitle}
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 36px;">
              
              <!-- Info Box -->
              <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #0d1322; border: 1px solid #1e293b; border-radius: 10px; padding: 16px 20px;">
                <tr>
                  <td width="50%" style="padding: 4px 8px; vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Organization</div>
                    <div style="font-size: 14px; color: #f8fafc; font-weight: 600; margin-top: 2px;">{org_name}</div>
                  </td>
                  <td width="50%" style="padding: 4px 8px; vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Target Identity</div>
                    <div style="font-size: 14px; color: #38bdf8; font-weight: 600; margin-top: 2px;">{user_email}</div>
                  </td>
                </tr>
                {f'''<tr>
                  <td width="100%" colspan="2" style="padding: 8px 8px 4px 8px; vertical-align: top; border-top: 1px solid #1e293b; margin-top: 6px;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">Origin Endpoint / IP</div>
                    <div style="font-size: 13px; color: #cbd5e1; font-weight: 600; margin-top: 2px; font-family: monospace;">{device_or_ip}</div>
                  </td>
                </tr>''' if device_or_ip else ''}
              </table>

              <p style="color: #94a3b8; font-size: 14px; line-height: 1.55; margin: 0 0 20px 0;">
                Use the following 6-digit security code to authenticate your session. This code will expire in <b>{expiry_minutes} minutes</b>.
              </p>

              <!-- OTP Code Display -->
              <div style="background-color: #0b0e14; border: 1px solid rgba(252, 213, 53, 0.4); border-radius: 10px; padding: 22px; text-align: center; font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 36px; font-weight: 800; color: #fcd535; letter-spacing: 10px; margin-bottom: 24px; box-shadow: 0 0 20px rgba(252, 213, 53, 0.12);">
                {otp_code}
              </div>

              <!-- Security Warning -->
              <div style="background-color: rgba(246, 70, 93, 0.08); border-left: 3px solid #f6465d; border-radius: 4px; padding: 12px 16px;">
                <p style="color: #f6465d; font-size: 12px; font-weight: 700; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                  ⚠️ Security Mandatory Notice
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.45;">
                  CipherWatch staff will never ask for your verification code. If you did not initiate this request, isolate your credentials immediately.
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0d1322; padding: 20px 36px; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b;">
              <p style="margin: 0 0 4px 0;">CipherWatch Identity Management • Zero-Trust Access Protocol</p>
              <p style="margin: 0; color: #475569;">Timestamp: {formatted_time}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# AUTOMATIC CRITICAL SECURITY THREAT DISPATCH (WITH 1-HOUR COOLDOWN)
# ---------------------------------------------------------------------------


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
    """Send high threat alert email via Resend API (strictly CRITICAL severity with 1h cooldown)."""
    # Enforce strictly CRITICAL severity for automatic email dispatch
    if (severity or "").upper() != "CRITICAL":
        return False

    # Cooldown check: prevent duplicate alert emails for same host/rule within 1 hour (3600s)
    now = time.time()
    for existing in SENT_EMAILS_LOG:
        if (
            existing.get("hostname") == hostname
            and existing.get("rule_id") == rule_id
            and (now - existing.get("timestamp", 0)) < 3600
        ):
            logger.info("Skipping duplicate CRITICAL email dispatch for host '{}' / rule '{}' (1-hour cooldown active)", hostname, rule_id)
            return False

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
        "status": "SENT" if settings.RESEND_API_KEY else "DISPATCHED (DEMO)",
        "html_content": html_content,
        "read": False,
    }
    SENT_EMAILS_LOG.append(mail_entry)

    payload = {
        "from": sender,
        "to": [admin_email],
        "subject": subject,
        "html": html_content,
    }

    success, resp_text, status_code = _send_resend_http_request(payload)
    if success:
        logger.info("Resend threat email sent successfully to {} for org '{}' (host: {})", admin_email, org_name, hostname)
        mail_entry["status"] = "SENT_RESEND"
        return True
    else:
        logger.error("Failed to send Resend threat email: status={}, resp={}", status_code, resp_text)
        mail_entry["status"] = "FAILED"
        return False


# ---------------------------------------------------------------------------
# AUTHENTICATION EMAILS (FORGOT PASSWORD & 2FA)
# ---------------------------------------------------------------------------


def send_forgot_password_otp_email(
    recipient_email: str,
    otp_code: str,
    org_name: str = "Default Organization",
    expiry_minutes: int = 10,
) -> bool:
    """Send Password Reset 6-digit OTP verification code via Resend API."""
    sender = settings.SENDER_EMAIL or "CipherWatch Security <onboarding@resend.dev>"
    subject = "CipherWatch Password Reset Code"

    html_content = generate_auth_otp_html(
        org_name=org_name,
        user_email=recipient_email,
        otp_code=otp_code,
        title="CipherWatch Password Reset Code",
        subtitle="Password Reset Authorization Code",
        expiry_minutes=expiry_minutes,
    )

    payload = {
        "from": sender,
        "to": [recipient_email],
        "subject": subject,
        "html": html_content,
    }

    success, resp_text, status_code = _send_resend_http_request(payload)
    if success:
        logger.info("Forgot Password OTP sent successfully to {}", recipient_email)
        return True
    else:
        logger.error("Failed to send Forgot Password OTP: status={}, resp={}", status_code, resp_text)
        return False


def send_2fa_otp_email(
    recipient_email: str,
    otp_code: str,
    org_name: str = "Default Organization",
    expiry_minutes: int = 10,
    device_or_ip: Optional[str] = None,
) -> bool:
    """Send Two-Factor Authentication 6-digit verification code via Resend API."""
    sender = settings.SENDER_EMAIL or "CipherWatch Security <onboarding@resend.dev>"
    subject = "CipherWatch Verification Code"

    html_content = generate_auth_otp_html(
        org_name=org_name,
        user_email=recipient_email,
        otp_code=otp_code,
        title="CipherWatch Verification Code",
        subtitle="Two-Factor Session Authentication Code",
        expiry_minutes=expiry_minutes,
        device_or_ip=device_or_ip,
    )

    payload = {
        "from": sender,
        "to": [recipient_email],
        "subject": subject,
        "html": html_content,
    }

    success, resp_text, status_code = _send_resend_http_request(payload)
    if success:
        logger.info("2FA OTP email sent successfully to {}", recipient_email)
        return True
    else:
        logger.error("Failed to send 2FA OTP email: status={}, resp={}", status_code, resp_text)
        return False


def send_otp_email(recipient_email: str, otp_code: str) -> bool:
    """Backward-compatible wrapper for OTP password reset emails."""
    return send_forgot_password_otp_email(recipient_email, otp_code)


# ---------------------------------------------------------------------------
# MANUAL DEMO / TEST THREAT EMAIL DISPATCH (ADMIN DEMO ENDPOINT)
# ---------------------------------------------------------------------------


def send_test_threat_alert_email(
    recipient_email: str,
    org_name: str = "HackIT Demo",
    hostname: str = "DESKTOP-DEMO",
    threat_name: str = "USB Data Exfiltration",
    severity: str = "CRITICAL",
    risk_score: float = 0.92,
    confidence: str = "94%",
    affected_user: str = "Demo User",
) -> Dict[str, Any]:
    """Manually dispatch a realistic Critical Threat Alert email for demonstration purposes.
    
    Does NOT write to AlertModel database or trigger cooldown.
    Returns detailed dictionary with success status and Resend API response / error explanation.
    """
    sender = settings.SENDER_EMAIL or "CipherWatch Security <onboarding@resend.dev>"
    subject = f"🚨 [{severity.upper()} DEMO THREAT] {threat_name} on Host '{hostname}'"
    formatted_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    message_str = (
        f"Automated threat detection rule triggered for host '{hostname}'. "
        f"Detected high-risk telemetry sequence ({threat_name}). Confidence: {confidence}."
    )

    html_content = generate_threat_alert_html(
        admin_email=recipient_email,
        org_name=org_name,
        device_name=hostname,
        hostname=hostname,
        severity=severity,
        rule_id=threat_name.upper().replace(" ", "_"),
        risk_score=risk_score,
        message=message_str,
        alert_time=formatted_time,
        affected_user=affected_user,
        confidence=confidence,
    )

    payload = {
        "from": sender,
        "to": [recipient_email],
        "subject": subject,
        "html": html_content,
    }

    success, resp_text, status_code = _send_resend_http_request(payload)

    if success:
        return {
            "success": True,
            "status_code": status_code,
            "message": f"Critical Threat Alert email successfully sent to {recipient_email} via Resend API",
            "details": {
                "sender": sender,
                "recipient": recipient_email,
                "subject": subject,
            },
        }
    else:
        error_msg = resp_text
        if "only send testing emails to your own email address" in resp_text:
            error_msg = (
                f"Resend Sandbox Restriction (HTTP {status_code}): "
                f"The configured sender '{sender}' is in test mode and can ONLY deliver emails to the "
                f"registered Resend account owner's email address. Verify your domain at resend.com/domains to send to '{recipient_email}'."
            )

        return {
            "success": False,
            "status_code": status_code,
            "error": error_msg,
            "details": {
                "sender": sender,
                "recipient": recipient_email,
                "raw_response": resp_text,
            },
        }
