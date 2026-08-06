import math
from typing import List, Tuple


class BaselineEngine:
    """Calculates user statistical baselines and z-score deviation risk modifiers."""

    @staticmethod
    def calculate_baseline_stats(values: List[float]) -> Tuple[float, float]:
        """Calculate mean and standard deviation for a metric baseline.

        Returns (mean, std_dev). If dataset has fewer than 2 data points,
        returns (mean, 1.0) to prevent zero division.
        """
        if not values:
            return 0.0, 1.0

        n = len(values)
        mean = sum(values) / n

        if n < 2:
            return mean, 1.0

        variance = sum((x - mean) ** 2 for x in values) / (n - 1)
        std_dev = math.sqrt(variance)

        # Fallback to 1.0 std_dev if variance is near 0
        if std_dev < 1e-6:
            std_dev = 1.0

        return mean, std_dev

    @staticmethod
    def compute_z_score(current_value: float, mean: float, std_dev: float) -> float:
        """Compute standard z-score metric delta."""
        if std_dev <= 0:
            return 0.0
        return (current_value - mean) / std_dev

    @classmethod
    def z_score_to_risk_modifier(cls, z_score: float) -> float:
        """Map z-score deviation to a risk score modifier between 0.0 and 0.35."""
        if z_score <= 0:
            return 0.0
        elif z_score <= 1.0:
            return 0.05
        elif z_score <= 2.0:
            return 0.15
        elif z_score <= 3.0:
            return 0.25
        else:
            return 0.35
