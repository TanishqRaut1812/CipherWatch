import pytest
import networkx as nx
from backend.graph.session_graph import SessionGraphBuilder


def test_session_graph_node_types():
    builder = SessionGraphBuilder()
    session_node = builder.add_session_node(
        session_id="sess_100", user_id="user_john", device_id="device_mac_01"
    )
    archive_node = builder.add_archive_node(
        archive_name="staged_data.7z", session_node=session_node, is_encrypted=True
    )
    dest_node = builder.add_destination_node(
        destination_name="dropbox.com", source_node=archive_node, dest_type="cloud"
    )

    g = builder.graph
    assert g.has_node("user:user_john")
    assert g.has_node("device:device_mac_01")
    assert g.has_node("session:sess_100")
    assert g.has_node("archive:staged_data.7z")
    assert g.has_node("destination:dropbox.com")

    assert g.nodes["user:user_john"]["node_type"] == "User"
    assert g.nodes["device:device_mac_01"]["node_type"] == "Device"
    assert g.nodes["session:sess_100"]["node_type"] == "Session"
    assert g.nodes["archive:staged_data.7z"]["node_type"] == "Archive"
    assert g.nodes["destination:dropbox.com"]["node_type"] == "Destination"


def test_session_graph_relationships():
    builder = SessionGraphBuilder()
    session_node = builder.add_session_node(
        session_id="sess_101", user_id="user_alice", device_id="device_win_02"
    )
    archive_node = builder.add_archive_node(
        archive_name="finance.zip", session_node=session_node, is_encrypted=True
    )
    dest_node = builder.add_destination_node(
        destination_name="USB_SanDisk", source_node=archive_node, dest_type="usb"
    )

    g = builder.graph
    assert g.has_edge("user:user_alice", "session:sess_101")
    assert g.edges["user:user_alice", "session:sess_101"]["relationship"] == "CREATED"

    assert g.has_edge("session:sess_101", "device:device_win_02")
    assert g.edges["session:sess_101", "device:device_win_02"]["relationship"] == "CONNECTED_TO"

    assert g.has_edge("session:sess_101", "archive:finance.zip")
    assert g.edges["session:sess_101", "archive:finance.zip"]["relationship"] == "CREATED"

    assert g.has_edge("archive:finance.zip", "destination:USB_SanDisk")
    assert g.edges["archive:finance.zip", "destination:USB_SanDisk"]["relationship"] == "UPLOADED_TO"


def test_session_graph_build_from_payload():
    builder = SessionGraphBuilder()
    session_payload = {
        "user_id": "user_devops",
        "device_id": "MAC-WORKSTATION",
        "session_id": 42,
        "events": [
            {
                "event_type": "FILE_CREATE",
                "metadata": {"extension": ".7z", "is_encrypted_archive": True, "file_name": "secrets.7z"},
            },
            {
                "event_type": "USB_INSERT",
                "metadata": {"vendor_id": "0x0781", "mount_point": "USB_FLASH_DRIVE"},
            },
            {
                "event_type": "NETWORK_CONNECTION",
                "metadata": {"destination_host": "anonfiles.com"},
            },
        ],
    }

    g = builder.build_from_session_payload(session_payload)

    assert len(g.nodes) >= 6
    assert g.has_node("user:user_devops")
    assert g.has_node("device:MAC-WORKSTATION")
    assert g.has_node("session:42")
    assert g.has_node("archive:secrets.7z")
    assert g.has_node("destination:USB_FLASH_DRIVE")
    assert g.has_node("destination:anonfiles.com")

    # Verify PRECEDED_BY sequence edges between events
    evt0 = "event:42:0:FILE_CREATE"
    evt1 = "event:42:1:USB_INSERT"
    evt2 = "event:42:2:NETWORK_CONNECTION"

    assert g.has_edge(evt0, evt1)
    assert g.edges[evt0, evt1]["relationship"] == "PRECEDED_BY"
    assert g.has_edge(evt1, evt2)
    assert g.edges[evt1, evt2]["relationship"] == "PRECEDED_BY"
