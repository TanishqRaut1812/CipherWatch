from agent.monitors.process import ProcessMonitor
from agent.monitors.network import NetworkMonitor
from shared.schemas import EventType


def test_process_classification():
    """Verify process classification logic."""
    is_cloud, is_browser = ProcessMonitor.classify_process("dropbox.exe")
    assert is_cloud is True
    assert is_browser is False

    is_cloud, is_browser = ProcessMonitor.classify_process("chrome")
    assert is_cloud is False
    assert is_browser is True

    is_cloud, is_browser = ProcessMonitor.classify_process("python3")
    assert is_cloud is False
    assert is_browser is False


def test_network_destination_classification():
    """Verify network connection category classification."""
    assert NetworkMonitor.classify_destination("content.dropboxapi.com", 443) == "CloudStorage"
    assert NetworkMonitor.classify_destination("mail.google.com", 443) == "PersonalWebmail"
    assert NetworkMonitor.classify_destination("discord.gg", 443) == "Messaging"
    assert NetworkMonitor.classify_destination("192.168.1.100", 80) == "WebHTTPS"
