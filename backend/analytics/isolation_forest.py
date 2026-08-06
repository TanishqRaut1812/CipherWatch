import os
import joblib
from typing import Any, Dict, List, Optional
import numpy as np
from sklearn.ensemble import IsolationForest

from shared.schemas import EventType


class AnomalyDetector:
    """Isolation Forest anomaly detection engine operating strictly on event metadata feature vectors."""

    def __init__(self, model_path: Optional[str] = None, contamination: float = 0.05, random_state: int = 42):
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), "isolation_forest_model.pkl")

        if os.path.exists(model_path):
            self.model = joblib.load(model_path)
            self.is_fitted = True
        else:
            self.model = IsolationForest(
                contamination=contamination,
                random_state=random_state,
                n_estimators=100,
            )
            self.is_fitted = False
            # Initialize default baseline training data
            self._fit_default_baseline()

    def extract_features(self, event_type: str, metadata: Dict[str, Any], timestamp_hour: int = 12) -> np.ndarray:
        """Extract 5-dimensional numerical feature vector from metadata without content inspection.

        Vector components:
        1. File size (bytes) or 0
        2. Timestamp hour of day (0-23)
        3. Encrypted archive flag (0 or 1)
        4. Sensitive folder tier (0: Standard, 1: Sensitive/SourceCode, 2: Restricted/Finance/HR)
        5. Cloud sync / Webmail category flag (0 or 1)
        """
        file_size = float(metadata.get("file_size_bytes", 0))
        is_encrypted = 1.0 if metadata.get("is_encrypted_archive", False) else 0.0

        folder_cat = str(metadata.get("folder_category", "Standard")).lower()
        sensitivity_score = 0.0
        tier2_keywords = ("finance", "payroll", "hr", "human_resources", "legal", "executive", "board", "tax")
        tier1_keywords = ("sourcecode", "source", "code", "confidential", "keys", "secrets", "credentials")

        if any(kw in folder_cat for kw in tier2_keywords):
            sensitivity_score = 2.0
        elif any(kw in folder_cat for kw in tier1_keywords):
            sensitivity_score = 1.0

        net_cat = metadata.get("destination_category", "General")
        cloud_flag = 1.0 if net_cat in ("CloudStorage", "Webmail") or metadata.get("is_cloud_sync", False) else 0.0

        return np.array([file_size, float(timestamp_hour), is_encrypted, sensitivity_score, cloud_flag])

    def _fit_default_baseline(self) -> None:
        """Fit Isolation Forest on baseline normal activity synthetic features."""
        # Generate synthetic normal baseline feature distribution
        np.random.seed(42)
        normal_sizes = np.random.exponential(scale=50000, size=200)
        normal_hours = np.random.randint(8, 18, size=200)  # Business hours
        normal_encrypted = np.zeros(200)
        normal_sensitivity = np.random.choice([0.0, 1.0], size=200, p=[0.8, 0.2])
        normal_cloud = np.random.choice([0.0, 1.0], size=200, p=[0.9, 0.1])

        X_baseline = np.column_stack([
            normal_sizes,
            normal_hours,
            normal_encrypted,
            normal_sensitivity,
            normal_cloud,
        ])
        self.model.fit(X_baseline)
        self.is_fitted = True

    def predict_anomaly_score(self, event_type: str, metadata: Dict[str, Any], timestamp_hour: int = 12) -> float:
        """Calculate normalized anomaly score between 0.0 (normal) and 1.0 (highly anomalous)."""
        feature_vec = self.extract_features(event_type, metadata, timestamp_hour).reshape(1, -1)

        # decision_function returns negative values for anomalies, positive for normal
        score_raw = self.model.decision_function(feature_vec)[0]

        # Map decision score to normalized 0.0 - 1.0 range
        # Typical decision range: [-0.5, 0.5] -> invert so low decision = high anomaly
        normalized_score = float(np.clip(0.5 - score_raw, 0.0, 1.0))
        return round(normalized_score, 4)
