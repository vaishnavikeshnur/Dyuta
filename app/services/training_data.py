# ==========================================
# GuardianMap - ML Training Dataset
# ==========================================

import random
from datetime import datetime

from app.services.ml_dataset import get_feature_names


def generate_training_data(samples=500):
    """
    Generate route-level training samples.

    Each sample represents a possible route and contains
    the same features used by GuardianMap's safety model.

    This is prototype/synthetic training data.
    It is NOT official crime data.
    """

    random.seed(42)

    feature_names = get_feature_names()

    X = []
    y = []

    for _ in range(samples):

        # --------------------------------------
        # Route characteristics
        # --------------------------------------

        distance_km = round(
            random.uniform(0.5, 12.0),
            2
        )

        # --------------------------------------
        # Safety reports
        # --------------------------------------

        report_count = random.randint(0, 5)

        verified_reports = random.randint(
            0,
            min(report_count, 3)
        )

        if report_count > 0:
            average_severity = round(
                random.uniform(1, 5),
                2
            )
        else:
            average_severity = 0

        # --------------------------------------
        # Distance of reports from route
        # --------------------------------------

        if report_count > 0:

            nearest_report_distance_km = round(
                random.uniform(0.05, 0.50),
                3
            )

            average_report_distance_km = round(
                random.uniform(
                    nearest_report_distance_km,
                    0.80
                ),
                3
            )

        else:

            nearest_report_distance_km = 0
            average_report_distance_km = 0

        # --------------------------------------
        # Nearby safe places
        # --------------------------------------

        safe_place_count = random.randint(0, 5)

        # --------------------------------------
        # Time
        # --------------------------------------

        current_hour = random.randint(0, 23)

        late_night = int(
            current_hour >= 22
            or current_hour < 5
        )

        evening = int(
            current_hour >= 19
            and current_hour < 22
        )

        features = {
            "distance_km": distance_km,
            "report_count": report_count,
            "verified_reports": verified_reports,
            "average_severity": average_severity,
            "nearest_report_distance_km":
                nearest_report_distance_km,
            "average_report_distance_km":
                average_report_distance_km,
            "safe_place_count": safe_place_count,
            "current_hour": current_hour,
            "late_night": late_night,
            "evening": evening
        }

        # --------------------------------------
        # Calculate prototype risk label
        # --------------------------------------

        risk = 0

        risk += report_count * 10
        risk += average_severity * 6
        risk += verified_reports * 8

        if nearest_report_distance_km > 0:
            if nearest_report_distance_km < 0.20:
                risk += 15
            elif nearest_report_distance_km < 0.50:
                risk += 8

        if late_night:
            risk += 18
        elif evening:
            risk += 7

        risk += distance_km * 1.2

        risk -= safe_place_count * 5

        # Small natural variation
        risk += random.uniform(-8, 8)

        # --------------------------------------
        # Convert risk into class
        # --------------------------------------

        if risk < 35:
            label = 0       # Low risk

        elif risk < 65:
            label = 1       # Moderate risk

        else:
            label = 2       # High risk

        X.append([
            features[name]
            for name in feature_names
        ])

        y.append(label)

    return X, y


if __name__ == "__main__":

    X, y = generate_training_data(500)

    print()
    print("==========================================")
    print("GuardianMap ML Training Dataset")
    print("==========================================")

    print("Samples:", len(X))
    print("Features:", len(X[0]))

    print()
    print("Feature names:")
    print(get_feature_names())

    print()
    print("Risk distribution:")

    print("Low risk:     ", y.count(0))
    print("Moderate risk:", y.count(1))
    print("High risk:    ", y.count(2))

    print()
    print("First sample:")
    print(X[0])

    print()
    print("First label:")
    print(y[0])

    print()
    print("Dataset generation successful.")