import pytest
from unittest.mock import MagicMock, patch
from agent.publisher import EventPublisher
from shared.schemas import EventCreate, EventType


def test_publisher_enqueue_and_drain():
    """Verify event enqueuing and queue draining."""
    publisher = EventPublisher(backend_url="http://localhost:8000")
    event = EventCreate(
        user_id="u1",
        device_id="d1",
        event_type=EventType.FILESYSTEM,
        metadata={"action": "created"},
    )

    assert publisher.publish(event) is True
    assert publisher.queue.qsize() == 1


@patch("httpx.Client.post")
def test_publisher_send_payload_success(mock_post):
    """Verify successful payload POST."""
    mock_resp = MagicMock()
    mock_resp.status_code = 201
    mock_post.return_value = mock_resp

    publisher = EventPublisher(backend_url="http://localhost:8000")
    event = EventCreate(
        user_id="u1",
        device_id="d1",
        event_type=EventType.USB,
        metadata={"action": "connected"},
    )

    success = publisher.send_payload(event)
    assert success is True
    assert mock_post.called
