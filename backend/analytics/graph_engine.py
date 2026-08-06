from typing import Any, Dict, List, Tuple
import networkx as nx


class GraphEngine:
    """Constructs directed graph representation of session event flows and evaluates exfiltration path patterns using NetworkX."""

    def build_session_graph(self, events: List[Dict[str, Any]]) -> nx.DiGraph:
        """
        Build a directed graph from an ordered sequence of event metadata dictionaries.
        Nodes represent individual events in temporal order; edges represent sequence flow.
        """
        G = nx.DiGraph()

        if not events:
            return G

        prev_node_id = None
        for idx, event in enumerate(events):
            event_type = event.get("event_type")
            metadata = event.get("metadata") or event.get("event_metadata") or {}
            node_id = f"event_{idx}_{event_type}"

            G.add_node(
                node_id,
                event_type=event_type,
                timestamp=event.get("timestamp"),
                metadata=metadata,
            )

            if prev_node_id is not None:
                G.add_edge(prev_node_id, node_id, relationship="FOLLOWS")

            prev_node_id = node_id

        return G

    def detect_exfiltration_paths(self, events: List[Dict[str, Any]]) -> Tuple[float, List[str]]:
        """
        Evaluates session event graph for multi-stage exfiltration sequence patterns.

        Returns:
            Tuple[float, List[str]]:
                - Risk score bounded strictly in [0.0, 1.0]
                - List of human-readable detected pattern names
        """
        if not events or len(events) < 2:
            return 0.0, []

        G = self.build_session_graph(events)
        detected_patterns = []
        accumulated_score = 0.0

        has_sensitive_file = False
        has_archive_staging = False
        has_external_outlet = False
        has_screen_clipboard_burst = False

        for node, data in G.nodes(data=True):
            event_type = data.get("event_type")
            meta = data.get("metadata") or {}

            # Analyze filesystem events
            if event_type == "filesystem":
                folder_category = str(meta.get("folder_category", "")).lower()
                if folder_category in ["finance", "hr", "executive", "sourcecode"]:
                    has_sensitive_file = True

                extension = str(meta.get("extension", "")).lower()
                if meta.get("is_encrypted_archive") or extension in [".zip", ".7z", ".rar", ".tar", ".gz"]:
                    has_archive_staging = True

            # Analyze network & USB outlet events
            elif event_type == "network":
                dest_category = str(meta.get("destination_category", "")).lower()
                if dest_category in ["personal_cloud", "personal_webmail", "unrecognized"]:
                    has_external_outlet = True
            elif event_type == "usb":
                action = str(meta.get("action", "")).lower()
                if action in ["connected", "mount", "transfer"]:
                    has_external_outlet = True

            # Analyze screen capture / clipboard burst events
            elif event_type in ["screenshot_event", "clipboard_burst"]:
                has_screen_clipboard_burst = True

        # Check composite path patterns
        if has_sensitive_file and has_archive_staging and has_external_outlet:
            detected_patterns.append("FULL_EXFILTRATION_CHAIN: Sensitive File -> Encrypted Archive -> External Outlet")
            accumulated_score += 0.85
        elif has_sensitive_file and has_external_outlet:
            detected_patterns.append("DIRECT_EXFILTRATION_PATH: Sensitive File -> External Outlet")
            accumulated_score += 0.65
        elif has_archive_staging and has_external_outlet:
            detected_patterns.append("STAGED_EXFILTRATION_PATH: Encrypted Archive -> External Outlet")
            accumulated_score += 0.50

        if has_screen_clipboard_burst and has_external_outlet:
            detected_patterns.append("SCREEN_CLIPBOARD_EXFILTRATION: Data Capture -> External Outlet")
            accumulated_score += 0.40

        final_score = min(max(accumulated_score, 0.0), 1.0)
        return final_score, detected_patterns
