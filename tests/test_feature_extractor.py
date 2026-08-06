import pytest
from backend.classifier.feature_extractor import SessionFeatureExtractor


def test_feature_extractor_vector_shape():
    extractor = SessionFeatureExtractor()
    names = extractor.feature_names()
    assert len(names) == 8

    session_payload = {"events": []}
    vec = extractor.extract_features(session_payload)
    assert len(vec) == 8
    assert vec == [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]


def test_feature_extractor_values():
    extractor = SessionFeatureExtractor()
    session_payload = {
        "user_id": "user_test",
        "events": [
            {
                "event_type": "FILE_CREATE",
                "timestamp": "2026-08-01T23:00:00Z",  # Off hours (11 PM)
                "metadata": {
                    "extension": ".7z",
                    "is_encrypted_archive": True,
                    "is_sensitive_folder": True,
                    "file_size_bytes": 1048576,
                },
            },
            {
                "event_type": "USB_INSERT",
                "timestamp": "2026-08-01T23:02:00Z",
                "metadata": {"vendor_id": "0x0781"},
            },
            {
                "event_type": "NETWORK_CONNECTION",
                "timestamp": "2026-08-01T23:05:00Z",
                "metadata": {"destination_host": "dropbox.com", "bytes_sent": 524288},
            },
            {
                "event_type": "SCREENSHOT_TAKEN",
                "timestamp": "2026-08-01T23:06:00Z",
                "metadata": {},
            },
        ],
    }

    vec = extractor.extract_features(session_payload)

    # Order: [has_archive, has_usb, is_off_hours, file_count, has_cloud, has_sensitive, has_screen_clip, total_bytes_log]
    assert vec[0] == 1.0  # has_archive (.7z encrypted)
    assert vec[1] == 1.0  # has_usb (USB_INSERT)
    assert vec[2] == 1.0  # is_off_hours (23:00)
    assert vec[3] == 1.0  # file_count (1 file create)
    assert vec[4] == 1.0  # has_cloud (NETWORK_CONNECTION)
    assert vec[5] == 1.0  # has_sensitive (is_sensitive_folder)
    assert vec[6] == 1.0  # has_screen_clip (SCREENSHOT_TAKEN)
    assert vec[7] > 0.0  # log1p(1048576 + 524288)
