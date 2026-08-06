"""
RandomForest Intent Classifier Module.

Uses a scikit-learn RandomForestClassifier trained on 8-dimensional session feature vectors
to calculate intent probability distributions across operational risk categories without local LLM overhead.
"""

from typing import Any, Dict, List
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from backend.classifier.feature_extractor import SessionFeatureExtractor


class RandomForestIntentClassifier:
    """CPU-only scikit-learn RandomForest classifier for session operational intent probability estimation."""

    INTENT_CLASSES = [
        "Routine Workspace Activity",
        "Cloud Exfiltration Staging",
        "USB Exfiltration Staging",
        "Mass Archive Staging",
        "Screen Capture & Clipboard Harvesting",
        "Possible Exfiltration",
    ]

    def __init__(self):
        self.extractor = SessionFeatureExtractor()
        self.model = RandomForestClassifier(n_estimators=25, random_state=42)
        self._initialize_and_train_baseline_model()

    def _initialize_and_train_baseline_model(self) -> None:
        """Generates synthetic baseline vectors and fits the RandomForest model."""
        # 8D Vector: [has_archive, has_usb, is_off_hours, file_count, has_cloud, has_sensitive, has_screen_clip, total_bytes_log]
        X = [
            # Class 0: Routine Workspace Activity
            [0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 5.0],
            [0.0, 0.0, 0.0, 5.0, 0.0, 0.0, 0.0, 8.0],
            [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 4.0],
            # Class 1: Cloud Exfiltration Staging
            [0.0, 0.0, 1.0, 10.0, 1.0, 1.0, 0.0, 15.0],
            [0.0, 0.0, 0.0, 15.0, 1.0, 1.0, 0.0, 18.0],
            [1.0, 0.0, 1.0, 5.0, 1.0, 1.0, 0.0, 16.0],
            # Class 2: USB Exfiltration Staging
            [0.0, 1.0, 1.0, 8.0, 0.0, 1.0, 0.0, 14.0],
            [1.0, 1.0, 0.0, 12.0, 0.0, 1.0, 0.0, 17.0],
            [0.0, 1.0, 0.0, 4.0, 0.0, 0.0, 0.0, 12.0],
            # Class 3: Mass Archive Staging
            [1.0, 0.0, 0.0, 25.0, 0.0, 1.0, 0.0, 19.0],
            [1.0, 0.0, 1.0, 50.0, 0.0, 1.0, 0.0, 20.0],
            # Class 4: Screen Capture & Clipboard Harvesting
            [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0, 2.0, 1.0, 0.0, 1.0, 10.0],
            # Class 5: Possible Exfiltration
            [1.0, 1.0, 1.0, 30.0, 1.0, 1.0, 1.0, 21.0],
            [1.0, 1.0, 1.0, 15.0, 1.0, 1.0, 0.0, 18.0],
        ]

        y = [
            0, 0, 0,  # Routine
            1, 1, 1,  # Cloud
            2, 2, 2,  # USB
            3, 3,     # Mass Archive
            4, 4,     # Screen/Clipboard
            5, 5,     # Possible Exfiltration
        ]

        self.model.fit(X, y)

    def predict_intent(self, session_data: Dict[str, Any]) -> str:
        """Predict top intent label for a session."""
        features = self.extractor.extract_features(session_data)
        prediction_idx = self.model.predict([features])[0]
        return self.INTENT_CLASSES[prediction_idx]

    def predict_proba(self, session_data: Dict[str, Any]) -> Dict[str, float]:
        """Predict probability distribution dictionary across all intent categories."""
        features = self.extractor.extract_features(session_data)
        probs = self.model.predict_proba([features])[0]

        proba_dict = {}
        for idx, cls_name in enumerate(self.model.classes_):
            label = self.INTENT_CLASSES[cls_name]
            proba_dict[label] = round(float(probs[idx]), 3)

        # Fill any missing classes with 0.0
        for cls_name in self.INTENT_CLASSES:
            if cls_name not in proba_dict:
                proba_dict[cls_name] = 0.0

        return proba_dict
