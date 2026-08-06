from typing import Dict, Any, List, Optional
from backend.analytics.rule_engine import RuleEngine
from backend.analytics.baseline_engine import BaselineEngine
from backend.analytics.graph_engine import GraphEngine
from backend.graph.pattern_queries import GraphPatternQueryEngine
from backend.graph.session_graph import SessionGraphBuilder
from backend.analytics.intent_classifier import IntentClassifier


class CompositeRiskEngine:
    """Aggregates Isolation Forest ML score, rule-based heuristic boosters,
    baseline z-score deviation, NetworkX graph pattern matching, folder sensitivity,
    and longitudinal drift into a normalized composite risk score [0.0, 1.0]
    and a granular 0-100 component factor breakdown.
    """

    SENSITIVE_FOLDER_CATEGORIES = [
        "finance", "payroll", "hr", "human_resources",
        "executive", "board", "sourcecode", "source", "code",
        "keys", "secrets", "credentials", "tax", "confidential"
    ]

    def __init__(self):
        self.rule_engine = RuleEngine()
        self.baseline_engine = BaselineEngine()
        self.graph_engine = GraphEngine()
        self.graph_builder = SessionGraphBuilder()
        self.pattern_engine = GraphPatternQueryEngine()
        self.intent_classifier = IntentClassifier()

    def evaluate_folder_sensitivity(self, folder_category: str) -> float:
        """Returns folder sensitivity bonus (0.0 to 0.25) if folder_category is sensitive."""
        if not folder_category:
            return 0.0
        cat_lower = str(folder_category).lower()
        for kw in self.SENSITIVE_FOLDER_CATEGORIES:
            if kw in cat_lower:
                return 0.25
        return 0.0

    def calculate_composite_risk(
        self,
        event_type: str,
        metadata: Dict[str, Any],
        timestamp_hour: int,
        ml_anomaly_score: float,
        current_metric_value: Optional[float] = None,
        historical_metric_values: Optional[List[float]] = None,
        session_events: Optional[List[Dict[str, Any]]] = None,
    ) -> float:
        """Calculate weighted composite risk score.

        Weights:
        - ML Anomaly Score: 40%
        - Rule Heuristic Bonus: 30%
        - Graph Pattern Bonus: 15%
        - Z-Score Baseline Bonus: 15%
        """
        # 1. ML Anomaly Score (normalized 0.0 - 1.0)
        ml_component = max(0.0, min(1.0, ml_anomaly_score))

        # 2. Rule Heuristic Booster (normalized 0.0 - 1.0)
        rule_bonus = self.rule_engine.compute_rule_bonus(
            event_type, metadata, timestamp_hour
        )

        # 3. Graph Pattern Score
        graph_bonus = 0.0
        if session_events:
            session_payload = {"events": session_events}
            graph_obj = self.graph_builder.build_from_session_payload(session_payload)
            pattern_eval = self.pattern_engine.evaluate_graph_patterns(graph_obj)
            graph_bonus = pattern_eval.get("pattern_risk_score", 0.0)

        # 4. Z-Score Baseline Deviation Component
        baseline_bonus = 0.0
        if current_metric_value is not None and historical_metric_values:
            mean, std_dev = self.baseline_engine.calculate_baseline_stats(
                historical_metric_values
            )
            z_score = self.baseline_engine.compute_z_score(
                current_metric_value, mean, std_dev
            )
            baseline_bonus = self.baseline_engine.z_score_to_risk_modifier(
                z_score
            )

        # Normalize baseline bonus to 0.0 - 1.0 (max modifier is 0.35)
        normalized_baseline = min(1.0, baseline_bonus / 0.35)

        # 5. Weighted Composite Score
        if session_events:
            composite_score = (
                (0.40 * ml_component)
                + (0.30 * rule_bonus)
                + (0.15 * graph_bonus)
                + (0.15 * normalized_baseline)
            )
        else:
            composite_score = (
                (0.50 * ml_component)
                + (0.35 * rule_bonus)
                + (0.15 * normalized_baseline)
            )

        return round(max(0.0, min(1.0, composite_score)), 4)

    def evaluate_risk_with_breakdown(
        self,
        session_payload: Dict[str, Any],
        ml_anomaly_score: float = 0.0,
        historical_metric_values: Optional[List[float]] = None,
        longitudinal_drift_score: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Computes unified Risk Score (0 - 100) and normalized composite score (0.0 - 1.0),
        returning a 6-component factor breakdown dict compatible with LLM prompt building.
        """
        events = session_payload.get("events", [])

        # 1. Isolation Forest ML component (25 pts max)
        ml_component = max(0.0, min(1.0, ml_anomaly_score))
        ml_pts = round(ml_component * 25.0, 1)

        # 2. Rule Engine Heuristic Bonus (25 pts max) & Folder Sensitivity (10 pts max)
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

            folder_cat = meta.get("folder_category", "") or meta.get("category", "")
            folder_boost_accum = max(folder_boost_accum, self.evaluate_folder_sensitivity(folder_cat))

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
        multiplier = pattern_eval.get("score_multiplier", 1.0)
        graph_pts = round(min(15.0, pattern_eval.get("pattern_risk_score", 0.0) * 15.0 * multiplier), 1)

        # 5. Longitudinal 14-Day Slow-Drip Drift (10 pts max)
        longitudinal_pts = round(max(0.0, min(1.0, longitudinal_drift_score)) * 10.0, 1)

        raw_total = ml_pts + rule_pts + folder_pts + baseline_pts + graph_pts + longitudinal_pts
        total_risk_score = round(min(100.0, raw_total), 1)
        composite_score = round(total_risk_score / 100.0, 4)

        predicted_intent, _ = self.intent_classifier.classify_session_intent(events)

        return {
            "risk_score": total_risk_score,
            "composite_score": composite_score,
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


