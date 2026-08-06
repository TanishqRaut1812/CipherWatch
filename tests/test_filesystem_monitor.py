from pathlib import Path
from agent.monitors.filesystem import FilesystemMetadataHandler, classify_folder_category
from shared.schemas import EventCreate, EventType


def test_folder_category_classification():
    """Verify folder sensitivity classification from path strings."""
    assert classify_folder_category("/home/user/Finance/payroll_2026.csv") == "Finance"
    assert classify_folder_category("/home/user/HR/employee_list.xlsx") == "HR"
    assert classify_folder_category("/home/user/src/backend/main.py") == "SourceCode"
    assert classify_folder_category("/home/user/Downloads/archive.zip") == "Downloads"
    assert classify_folder_category("/home/user/Documents/report.docx") == "General"


def test_filesystem_metadata_handler_emit():
    """Verify metadata handler emits valid EventCreate payload without content reading."""
    captured_events = []

    def mock_callback(event: EventCreate):
        captured_events.append(event)

    handler = FilesystemMetadataHandler(
        user_id="user-test",
        device_id="device-test",
        emit_callback=mock_callback,
    )

    class DummyEvent:
        is_directory = False
        src_path = "/home/user/Finance/secret_records.zip"

    handler.on_created(DummyEvent())

    assert len(captured_events) == 1
    event = captured_events[0]
    assert event.user_id == "user-test"
    assert event.event_type == EventType.FILESYSTEM
    assert event.metadata["action"] == "created"
    assert event.metadata["extension"] == ".zip"
    assert event.metadata["is_encrypted_archive"] is True
    assert event.metadata["folder_category"] == "Finance"
