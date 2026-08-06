"""
Hybrid Risk Scorer Module.

Combines Isolation Forest anomaly scores, rule heuristics (including folder sensitivity),
baseline z-scores, graph relationship topology patterns, and 14-day longitudinal drift
into a unified 0-100 Risk Score with a granular component breakdown dictionary.
"""

from typing import Any, Dict, List, Optional
from backend.analytics.rule_engine import RuleEngine
from backend.analytics.baseline_engine import BaselineEngine
from backend.graph.pattern_queries import GraphPatternQueryEngine
from backend.graph.session_graph import SessionGraphBuilder
from backend.classifier.intent_model import RandomForestIntentClassifier


class HybridRiskScorer:
    """Aggregates multi-detector signals into a 0-100 unified risk score with visual breakdown components."""

    SENSITIVE_FOLDER_KEYWORDS = [
        "finance", "payroll", "hr", "human_resources",
        "executive", "board", "source", "code", "keys",
        "secrets", "credentials", "tax", "confidential"
    ]

    def __init__(self):
        self.rule_engine = RuleEngine()
        self.baseline_engine = BaselineEngine()
        self.graph_builder = SessionGraphBuilder()
        self.pattern_engine = GraphPatternQueryEngine()
        self.intent_classifier = RandomForestIntentClassifier()

    def evaluate_folder_sensitivity(self, file_path: str) -> float:
        """Returns folder sensitivity bonus (0.0 to 0.25) if path contains sensitive keywords."""
        if not file_path:
            return 0.0
        path_lower = file_path.lower()
        for kw in self.SENSITIVE_FOLDER_KEYWORDS:
            if kw in path_lower:
                return 0.25
        return 0.0

    def compute_hybrid_risk_score(
        self,
        session_payload: Dict[str, Any],
        ml_anomaly_score: float = 0.0,
        historical_metric_values: Optional[List[float]] = None,
        longitudinal_drift_score: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Computes a unified Risk Score (0 - 100) and returns a component factor breakdown dict.

        Weights Breakdown (Total 100 points max):
        - Isolation Forest ML Score: 25 pts max
        - Heuristic Rule Bonuses (inc. off-hours, USB, archive, screen burst): 25 pts max
        - Folder Sensitivity Boost: 10 pts max
        - Baseline Z-Score Deviation: 15 pts max
        - Session Graph Topology Patterns: 15 pts max
        - 14-Day Longitudinal Slow-Drip Drift: 10 pts max
        """
        events = session_payload.get("events", [])

        # 1. Isolation Forest ML component (25 pts max)
        ml_pts = round(max(0.0, min(1.0, ml_anomaly_score)) * 25.0, 1)

        # 2. Rule Engine Heuristic Bonus (25 pts max)
        rule_score_accum = 0.0
        folder_boost_accum = 0.0

        for evt in events:
            evt_type = evt.get("event_type", "")
            meta = evt.get("metadata") or evt.get("event_metadata") or {}
            ts_str = evt.get("timestamp", "")
            hour = 12
            if ts_str and "T" in ts_str:
                try:
                    hour = int(ts_str.split("T")[1].split(":")[0])
                except Exception:
                    pass

            r_bonus = self.rule_engine.compute_rule_bonus(evt_type, meta, hour)
            rule_score_accum = max(rule_score_accum, r_bonus)

            file_path = meta.get("file_path", "") or meta.get("file_name", "")
            folder_boost_accum = max(folder_boost_accum, self.evaluate_folder_sensitivity(file_path))

        rule_pts = round(min(1.0, rule_score_accum) * 25.0, 1)
        folder_pts = round(folder_boost_accum * 10.0, 1)

        # 3. Baseline Z-Score Deviation (15 pts max)
        baseline_pts = 0.0
        if historical_metric_values and len(events) > 0:
            current_metric = float(len(events))
            mean, std = self.baseline_engine.calculate_baseline_stats(historical_metric_values)
            z_score = self.baseline_engine.compute_z_score(current_metric, mean, std)
            baseline_mod = self.baseline_engine.z_score_to_risk_modifier(z_score)
            baseline_pts = round(min(1.0, baseline_mod / 0.35) * 15.0, 1)

        # 4. Session Graph Topology Patterns (15 pts max)
        graph_obj = self.graph_builder.build_from_session_payload(session_payload)
        pattern_eval = self.pattern_engine.evaluate_graph_patterns(graph_obj)
        graph_pts = round(pattern_eval.get("pattern_risk_score", 0.0) * 15.0, 1)

        # Apply score multiplier to graph component if multi-step chain detected
        multiplier = pattern_eval.get("score_multiplier", 1.0)
        graph_pts = round(min(15.0, graph_pts * multiplier), 1)

        # 5. Longitudinal 14-Day Slow-Drip Drift (10 pts max)
        longitudinal_pts = round(max(0.0, min(1.0, longitudinal_drift_score)) * 10.0, 1)

        # Aggregate total risk score [0 - 100]
        raw_total = ml_pts + rule_pts + folder_pts + baseline_pts + graph_pts + longitudinal_pts
        total_risk_score = round(min(100.0, raw_total), 1)

        # Classify Intent for context
        predicted_intent = self.intent_classifier.predict_intent(session_payload)

        return {
            "risk_score": total_risk_score,
            "predicted_intent": predicted_intent,
            "breakdown": {
                "isolation_forest_ml": ml_pts,
                "rule_heuristics": rule_pts,
                "folder_sensitivity": folder_pts,
                "baseline_deviation": baseline_pts,
                "graph_topology": graph_pts,
                "longitudinal_drift": longitudinal_pts,
            },
            "matched_patterns": pattern_eval.get("matched_patterns", []),
            "topology_multiplier": multiplier,
        }
