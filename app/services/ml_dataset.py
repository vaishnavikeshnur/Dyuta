# ==========================================
# GuardianMap - ML Dataset Preparation
# ==========================================

from datetime import datetime


def report_to_features(report):
    """
    Convert one GuardianMap SafetyReport
    into numerical ML features.
    """

    severity = int(
        getattr(report, "severity", 3) or 3
    )

    verified = int(
        bool(getattr(report, "verified", False))
    )

    latitude = float(
        getattr(report, "latitude", 0) or 0
    )

    longitude = float(
        getattr(report, "longitude", 0) or 0
    )

    return {
        "severity": severity,
        "verified": verified,
        "latitude": latitude,
        "longitude": longitude
    }


def reports_to_dataset(reports):
    """
    Convert a list of SafetyReport objects
    into ML-ready feature rows.
    """

    dataset = []

    for report in reports:

        features = report_to_features(report)

        dataset.append(features)

    return dataset


def create_training_row(
    distance_km,
    report_count,
    verified_reports,
    average_severity,
    nearest_report_distance_km,
    average_report_distance_km,
    safe_place_count,
    current_hour
):
    """
    Create one complete route-level ML feature row.
    """

    late_night = int(
        current_hour >= 22
        or current_hour < 5
    )

    evening = int(
        current_hour >= 19
        and current_hour < 22
    )

    return {
        "distance_km": round(distance_km, 3),

        "report_count": report_count,

        "verified_reports": verified_reports,

        "average_severity": round(
            average_severity,
            3
        ),

        "nearest_report_distance_km": round(
            nearest_report_distance_km,
            3
        ),

        "average_report_distance_km": round(
            average_report_distance_km,
            3
        ),

        "safe_place_count": safe_place_count,

        "current_hour": current_hour,

        "late_night": late_night,

        "evening": evening
    }


def get_feature_names():
    """
    Return the feature columns that will be used
    by the ML model.
    """

    return [
        "distance_km",
        "report_count",
        "verified_reports",
        "average_severity",
        "nearest_report_distance_km",
        "average_report_distance_km",
        "safe_place_count",
        "current_hour",
        "late_night",
        "evening"
    ]