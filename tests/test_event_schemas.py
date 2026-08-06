from shared.schemas import (
    ClipboardBurstMetadata,
    EventCreate,
    EventType,
    FilesystemMetadata,
    NetworkMetadata,
    ProcessMetadata,
    ScreenshotEventMetadata,
    USBMetadata,
)


def test_filesystem_metadata_schema_privacy():
    """Verify FilesystemMetadata schema has zero content fields."""
    fs_data = FilesystemMetadata(
        action="archived",
        extension=".zip",
        file_size_bytes=1048576,
        is_encrypted_archive=True,
        folder_category="Finance",
    )
    data_dict = fs_data.model_dump()
    assert "file_content" not in data_dict
    assert "text" not in data_dict
    assert data_dict["is_encrypted_archive"] is True


def test_event_create_validation():
    """Verify EventCreate Pydantic model parses valid payload correctly."""
    event = EventCreate(
        user_id="user-01",
        device_id="dev-01",
        event_type=EventType.USB,
        metadata={"action": "connected", "vendor_id": "0403", "mount_point": "/media/usb"},
    )
    assert event.event_type == EventType.USB
    assert event.user_id == "user-01"
    assert event.metadata["vendor_id"] == "0403"


def test_privacy_guarantee_no_sensitive_content_fields():
    """Assert all metadata schemas contain zero raw content or screen pixel fields."""
    forbidden_fields = {"content", "file_content", "body", "email_text", "screen_image", "pixels", "clipboard_text"}

    for schema_cls in [
        FilesystemMetadata,
        USBMetadata,
        NetworkMetadata,
        ProcessMetadata,
        ScreenshotEventMetadata,
        ClipboardBurstMetadata,
    ]:
        field_names = set(schema_cls.model_fields.keys())
        intersection = field_names.intersection(forbidden_fields)
        assert len(intersection) == 0, f"Schema {schema_cls.__name__} contains forbidden field: {intersection}"
