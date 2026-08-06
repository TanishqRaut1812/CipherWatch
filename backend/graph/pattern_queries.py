"""
Graph Pattern Queries Module.

Executes pattern matching queries over NetworkX session relationship graphs
to detect complex multi-step exfiltration topologies (e.g. Encrypted Archive + USB + Cloud Upload within session).
"""

from typing import Any, Dict, List, Tuple
import networkx as nx


class GraphPatternQueryEngine:
    """Evaluates session relationship graph topologies against high-risk exfiltration query patterns."""

    def match_triple_exfiltration_chain(
        self, graph: nx.DiGraph
    ) -> Tuple[bool, float, str]:
        """Detects multi-step pattern: "Session containing Encrypted Archive AND USB Insert AND Cloud Upload".

        Returns: (is_matched, multiplier_boost, pattern_description)
        """
        has_archive = False
        has_usb = False
        has_cloud = False

        for node, data in graph.nodes(data=True):
            node_type = data.get("node_type")
            if node_type == "Archive":
                has_archive = True
            elif node_type == "Destination":
                dest_type = str(data.get("dest_type", "")).lower()
                if dest_type in ("usb", "removable"):
                    has_usb = True
                elif dest_type in ("cloud", "webmail", "unrecognized_storage"):
                    has_cloud = True
            elif node_type == "Event":
                evt_type = data.get("event_type")
                meta = data.get("metadata") or {}
                if meta.get("is_encrypted_archive") or meta.get("extension") in (".zip", ".7z", ".rar"):
                    has_archive = True
                if evt_type == "USB_INSERT":
                    has_usb = True
                if evt_type == "NETWORK_CONNECTION":
                    has_cloud = True

        if has_archive and has_usb and has_cloud:
            return (
                True,
                1.50,
                "TRIPLE_EXFILTRATION_CHAIN: Encrypted Archive + USB Insert + Cloud Upload within session window",
            )
        return False, 1.0, ""

    def match_staged_archive_exfiltration(
        self, graph: nx.DiGraph
    ) -> Tuple[bool, float, str]:
        """Detects staged exfiltration: Encrypted Archive uploaded to external destination."""
        has_archive = False
        has_outlet = False

        for node, data in graph.nodes(data=True):
            node_type = data.get("node_type")
            if node_type == "Archive":
                has_archive = True
            elif node_type == "Destination":
                has_outlet = True

        if has_archive and has_outlet:
            return (
                True,
                1.30,
                "STAGED_ARCHIVE_EXFILTRATION: Encrypted Archive linked to Destination outlet",
            )
        return False, 1.0, ""

    def match_screen_clipboard_exfiltration(
        self, graph: nx.DiGraph
    ) -> Tuple[bool, float, str]:
        """Detects screen/clipboard harvesting linked to exfiltration outlet."""
        has_harvesting = False
        has_outlet = False

        for node, data in graph.nodes(data=True):
            node_type = data.get("node_type")
            if node_type == "Event":
                evt_type = data.get("event_type")
                if evt_type in ("SCREENSHOT_TAKEN", "CLIPBOARD_BURST", "screenshot_event", "clipboard_burst"):
                    has_harvesting = True
            elif node_type == "Destination":
                has_outlet = True

        if has_harvesting and has_outlet:
            return (
                True,
                1.25,
                "SCREEN_CLIPBOARD_EXFILTRATION: Screen/Clipboard harvesting linked to Destination outlet",
            )
        return False, 1.0, ""

    def evaluate_graph_patterns(self, graph: nx.DiGraph) -> Dict[str, Any]:
        """Runs all pattern queries against the session graph topology and returns composite multiplier & details."""
        matches: List[str] = []
        max_multiplier = 1.0

        queries = [
            self.match_triple_exfiltration_chain,
            self.match_staged_archive_exfiltration,
            self.match_screen_clipboard_exfiltration,
        ]

        for query_func in queries:
            matched, mult, desc = query_func(graph)
            if matched:
                matches.append(desc)
                max_multiplier = max(max_multiplier, mult)

        # Calculate normalized pattern risk score modifier [0.0 - 1.0]
        pattern_risk_score = min(1.0, round((max_multiplier - 1.0) / 0.5, 2))

        return {
            "matched_patterns": matches,
            "score_multiplier": max_multiplier,
            "pattern_risk_score": pattern_risk_score,
        }
