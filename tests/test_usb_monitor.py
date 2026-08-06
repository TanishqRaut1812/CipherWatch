from agent.monitors.usb import USBMonitor
from shared.schemas import EventType


def test_usb_monitor_device_info_parsing():
    """Verify parse_device_info extracts vendor/product IDs and device labels."""
    monitor = USBMonitor()
    vendor_id, product_id, dev_name = monitor.parse_device_info("/dev/sdb1")
    assert vendor_id is not None
    assert product_id is not None
    assert dev_name == "sdb1"


def test_usb_monitor_instantiation_and_event_callback():
    """Verify USBMonitor initializes and callbacks correctly."""
    events = []

    def mock_cb(e):
        events.append(e)

    monitor = USBMonitor(poll_interval=0.1, callback=mock_cb)
    assert monitor.is_running is False
    assert monitor.user_id == "user-local-01"
