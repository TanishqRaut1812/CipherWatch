"""
Session Relationship Graph Module.

Constructs an in-memory NetworkX graph representation of entity relationships
across sessions, users, devices, archives, and destinations.
"""

from typing import Any, Dict, List, Optional
import networkx as nx


class SessionGraphBuilder:
    """Manages NetworkX graph construction for multi-entity session topology."""

    def __init__(self):
        self.graph = nx.DiGraph()

    def add_user_node(self, user_id: str) -> str:
        """Add a User node to the graph."""
        node_id = f"user:{user_id}"
        if not self.graph.has_node(node_id):
            self.graph.add_node(node_id, node_type="User", user_id=user_id)
        return node_id

    def add_device_node(self, device_id: str) -> str:
        """Add a Device node to the graph."""
        node_id = f"device:{device_id}"
        if not self.graph.has_node(node_id):
            self.graph.add_node(node_id, node_type="Device", device_id=device_id)
        return node_id

    def add_session_node(self, session_id: Any, user_id: str, device_id: str) -> str:
        """Add a Session node and link CREATED (User -> Session) and CONNECTED_TO (Session -> Device)."""
        session_node = f"session:{session_id}"
        self.graph.add_node(session_node, node_type="Session", session_id=session_id)

        user_node = self.add_user_node(user_id)
        device_node = self.add_device_node(device_id)

        # Edges
        self.graph.add_edge(user_node, session_node, relationship="CREATED")
        self.graph.add_edge(session_node, device_node, relationship="CONNECTED_TO")

        return session_node

    def add_archive_node(
        self, archive_name: str, session_node: str, is_encrypted: bool = False
    ) -> str:
        """Add an Archive node and link CREATED (Session -> Archive)."""
        archive_node = f"archive:{archive_name}"
        self.graph.add_node(
            archive_node,
            node_type="Archive",
            name=archive_name,
            is_encrypted=is_encrypted,
        )
        self.graph.add_edge(session_node, archive_node, relationship="CREATED")
        return archive_node

    def add_destination_node(
        self,
        destination_name: str,
        source_node: str,
        dest_type: str = "cloud",
    ) -> str:
        """Add a Destination node (USB/Cloud/Webmail) and link UPLOADED_TO or CONNECTED_TO."""
        dest_node = f"destination:{destination_name}"
        self.graph.add_node(
            dest_node,
            node_type="Destination",
            name=destination_name,
            dest_type=dest_type,
        )
        self.graph.add_edge(source_node, dest_node, relationship="UPLOADED_TO")
        return dest_node

    def build_from_session_payload(self, session_data: Dict[str, Any]) -> nx.DiGraph:
        """Parse a structured session telemetry dictionary and populate the graph topology.

        Nodes: User, Device, Session, Archive, Destination
        Edges: CREATED, CONNECTED_TO, UPLOADED_TO, PRECEDED_BY
        """
        user_id = session_data.get("user_id", "unknown_user")
        device_id = session_data.get("device_id", "unknown_device")
        session_id = session_data.get("session_id", "unknown_session")

        session_node = self.add_session_node(session_id, user_id, device_id)
        events = session_data.get("events", [])

        prev_event_node = None
        current_archive_node = None

        for idx, evt in enumerate(events):
            evt_type = evt.get("event_type", "UNKNOWN")
            meta = evt.get("metadata") or evt.get("event_metadata") or {}
            event_node = f"event:{session_id}:{idx}:{evt_type}"

            self.graph.add_node(event_node, node_type="Event", event_type=evt_type, metadata=meta)
            self.graph.add_edge(session_node, event_node, relationship="CONTAINS")

            if prev_event_node:
                self.graph.add_edge(prev_event_node, event_node, relationship="PRECEDED_BY")
            prev_event_node = event_node

            # Handle Archive Creation
            if evt_type in ("FILE_CREATE", "filesystem"):
                ext = str(meta.get("extension", "")).lower()
                is_enc = meta.get("is_encrypted_archive", False) or ext in (".zip", ".7z", ".rar", ".tar", ".gz")
                if is_enc:
                    archive_name = meta.get("file_name") or f"archive_{idx}{ext or '.zip'}"
                    current_archive_node = self.add_archive_node(archive_name, session_node, is_encrypted=is_enc)
                    self.graph.add_edge(event_node, current_archive_node, relationship="CREATED")

            # Handle USB Connections
            elif evt_type in ("USB_INSERT", "usb"):
                vendor_id = meta.get("vendor_id") or meta.get("mount_point") or "USB_Storage"
                dest_node = self.add_destination_node(vendor_id, session_node, dest_type="usb")
                if current_archive_node:
                    self.graph.add_edge(current_archive_node, dest_node, relationship="UPLOADED_TO")

            # Handle Cloud & Network Uploads
            elif evt_type in ("NETWORK_CONNECTION", "network"):
                dest_host = meta.get("destination_host") or meta.get("remote_address") or "External_Cloud"
                dest_node = self.add_destination_node(dest_host, session_node, dest_type="cloud")
                if current_archive_node:
                    self.graph.add_edge(current_archive_node, dest_node, relationship="UPLOADED_TO")

        return self.graph
