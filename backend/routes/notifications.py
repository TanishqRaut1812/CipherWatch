from typing import List, Optional
from fastapi import APIRouter, Query
from backend.services.email_service import get_sent_emails_log, SENT_EMAILS_LOG

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def _build_notifications_payload(admin_email: Optional[str] = None):
    logs = get_sent_emails_log()
    if admin_email:
        logs = [m for m in logs if m.get("admin_email", "").lower() == admin_email.lower()]
    return {
        "total": len(logs),
        "unread_count": sum(1 for m in logs if not m.get("read")),
        "notifications": logs,
    }


@router.get("")
def list_notifications_root(admin_email: Optional[str] = None):
    """Retrieve list of resent email notifications."""
    return _build_notifications_payload(admin_email)


@router.get("/emails")
def list_notifications_emails(admin_email: Optional[str] = None):
    """Retrieve list of resent email notifications (emails path)."""
    return _build_notifications_payload(admin_email)


@router.post("/mark-all-read")
def mark_all_notifications_read():
    """Mark all sent email notifications as read."""
    for log in SENT_EMAILS_LOG:
        log["read"] = True
    return {"status": "ok"}


@router.post("/{notification_id}/read")
def mark_notification_read(notification_id: str):
    """Mark a specific email notification as read."""
    for log in SENT_EMAILS_LOG:
        if log["id"] == notification_id:
            log["read"] = True
            return {"status": "ok", "id": notification_id}
    return {"status": "not_found"}
