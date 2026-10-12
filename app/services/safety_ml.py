# ==========================================
# GuardianMap - ML Safety Prediction
# ==========================================

from datetime import datetime
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2

import joblib


# ------------------------------------------
# Load trained ML model
# ------------------------------------------

MODEL_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "ml_models"
    / "guardian_safety_model.joblib"
)

_model_data = None


def load_model():
    """
    Load the trained GuardianMap Random Forest model.
    """

    global _model_data

    if _model_data is None:

        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Safety ML model not found: {MODEL_PATH}"
            )

        _model_data = joblib.load(MODEL_PATH)

    return _model_data


# ------------------------------------------
# Utility: distance between coordinates
# ------------------------------------------

def distance_km(lat1, lon1, lat2, lon2):

    earth_radius = 6371.0

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(dlon / 2) ** 2
    )

    return earth_radius * 2 * atan2(
        sqrt(a),
        sqrt(1 - a)
    )


# ------------------------------------------
# Feature extraction
# ------------------------------------------

def extract_features(
    route,
    reports=None,
    current_hour=None,
    safe_place_count=0
):

    if reports is None:
        reports = []

    # --------------------------------------
    # Route distance
    # --------------------------------------

    distance = float(
        route.get("distance_km", 0)
    )

    # --------------------------------------
    # Safety reports
    # --------------------------------------

    report_count = len(reports)

    verified_reports = sum(
        1
        for report in reports
        if getattr(report, "verified", False)
    )

    # --------------------------------------
    # Average severity
    # --------------------------------------

    if report_count > 0:

        total_severity = sum(
            int(
                getattr(
                    report,
                    "severity",
                    3
                ) or 3
            )
            for report in reports
        )

        average_severity = (
            total_severity / report_count
        )

    else:

        average_severity = 0

    # --------------------------------------
    # Report distance from route
    # --------------------------------------

    report_distances = []

    for report in reports:

        distance_from_route = getattr(
            report,
            "distance_from_route_km",
            None
        )

        if distance_from_route is not None:

            report_distances.append(
                float(distance_from_route)
            )

    if report_distances:

        nearest_report_distance = min(
            report_distances
        )

        average_report_distance = (
            sum(report_distances)
            / len(report_distances)
        )

    else:

        nearest_report_distance = 0
        average_report_distance = 0

    # --------------------------------------
    # Time of day
    # --------------------------------------

    if current_hour is None:
        current_hour = datetime.now().hour

    late_night = (
        current_hour >= 22
        or current_hour < 5
    )

    evening = (
        current_hour >= 19
        and current_hour < 22
    )

    # --------------------------------------
    # Return EXACT training features
    # --------------------------------------

    return {
        "distance_km": round(
            distance,
            2
        ),

        "report_count": report_count,

        "verified_reports": verified_reports,

        "average_severity": round(
            average_severity,
            2
        ),

        "nearest_report_distance_km": round(
            nearest_report_distance,
            3
        ),

        "average_report_distance_km": round(
            average_report_distance,
            3
        ),

        "safe_place_count": safe_place_count,

        "current_hour": current_hour,

        "late_night": int(
            late_night
        ),

        "evening": int(
            evening
        )
    }


# ------------------------------------------
# Convert ML class to risk level
# ------------------------------------------

def risk_from_prediction(prediction):

    mapping = {
        0: "Low",
        1: "Moderate",
        2: "High"
    }

    return mapping.get(
        int(prediction),
        "Moderate"
    )


# ------------------------------------------
# Convert risk to safety score
# ------------------------------------------

def score_from_risk(
    risk_level,
    probabilities=None
):

    # If probability information is available,
    # use it to create a smoother score.

    if probabilities is not None:

        low_probability = probabilities.get(
            "Low",
            0
        )

        moderate_probability = probabilities.get(
            "Moderate",
            0
        )

        high_probability = probabilities.get(
            "High",
            0
        )

        score = (
            low_probability * 90
            + moderate_probability * 60
            + high_probability * 25
        )

        return max(
            0,
            min(
                100,
                round(score)
            )
        )

    # Fallback score

    if risk_level == "Low":
        return 85

    if risk_level == "Moderate":
        return 60

    return 30


# ------------------------------------------
# Main ML prediction
# ------------------------------------------

def predict_safety(features):

    # Load trained Random Forest
    model_data = load_model()

    model = model_data["model"]

    feature_names = model_data[
        "feature_names"
    ]

    # --------------------------------------
    # Make sure feature order is identical
    # to training
    # --------------------------------------

    feature_vector = [
        features[name]
        for name in feature_names
    ]

    # --------------------------------------
    # Random Forest prediction
    # --------------------------------------

    prediction = model.predict(
        [feature_vector]
    )[0]

    risk_level = risk_from_prediction(
        prediction
    )

    # --------------------------------------
    # Prediction probabilities
    # --------------------------------------

    probabilities = None

    if hasattr(
        model,
        "predict_proba"
    ):

        probability_values = (
            model.predict_proba(
                [feature_vector]
            )[0]
        )

        probabilities = {}

        for class_value, probability in zip(
            model.classes_,
            probability_values
        ):

            class_risk = risk_from_prediction(
                class_value
            )

            probabilities[
                class_risk
            ] = float(probability)

    # --------------------------------------
    # Safety score
    # --------------------------------------

    safety_score = score_from_risk(
        risk_level,
        probabilities
    )

    # --------------------------------------
    # Explanation
    # --------------------------------------

    reasons = []

    if features["report_count"] > 0:

        reasons.append(
            f"{features['report_count']} "
            "safety report(s) were considered"
        )

    if features["verified_reports"] > 0:

        reasons.append(
            f"{features['verified_reports']} "
            "report(s) are marked as verified"
        )

    if features["average_severity"] >= 4:

        reasons.append(
            "reported incidents have relatively "
            "high severity"
        )

    if features[
        "nearest_report_distance_km"
    ] > 0:

        reasons.append(
            "safety reports were detected near "
            "the route"
        )

    if features["late_night"]:

        reasons.append(
            "late-night travel is being considered"
        )

    elif features["evening"]:

        reasons.append(
            "evening travel is being considered"
        )

    if features["safe_place_count"] > 0:

        reasons.append(
            f"{features['safe_place_count']} "
            "nearby safe place(s) were considered"
        )

    if not reasons:

        reasons.append(
            "no significant risk indicators "
            "were available"
        )

    explanation = (
        "GuardianMap ML safety assessment. "
        "This is an advisory estimate and is "
        "not a guarantee of personal safety. "
        + " ".join(reasons)
        + "."
    )

    return {
        "safety_score": safety_score,
        "risk_level": risk_level,
        "features": features,
        "explanation": explanation,
        "ml_prediction": int(prediction),
        "ml_probabilities": probabilities
    }


# ------------------------------------------
# Public function used by GuardianMap
# ------------------------------------------

def assess_route_safety(
    route,
    reports=None,
    current_hour=None,
    safe_place_count=0
):

    features = extract_features(
        route=route,
        reports=reports,
        current_hour=current_hour,
        safe_place_count=safe_place_count
    )

    prediction = predict_safety(
        features
    )

    return prediction