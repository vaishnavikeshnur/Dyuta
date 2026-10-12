import httpx
from math import radians, sin, cos, sqrt, atan2

from app.services.safety_ml import assess_route_safety

OSRM_BASE = "https://router.project-osrm.org/route/v1"

def haversine_km(a_lat, a_lng, b_lat, b_lng):
    R = 6371.0
    dlat = radians(b_lat-a_lat)
    dlng = radians(b_lng-a_lng)
    x = sin(dlat/2)**2 + cos(radians(a_lat))*cos(radians(b_lat))*sin(dlng/2)**2
    return R * 2 * atan2(sqrt(x), sqrt(1-x))
def distance_to_route_km(lat, lng, route_points):
    """
    Calculate the minimum approximate distance between
    a safety report and the actual route geometry.

    route_points format:
    [
        [lat, lng],
        [lat, lng],
        ...
    ]
    """

    if not route_points:
        return float("inf")

    minimum_distance = float("inf")

    for point in route_points:
        route_lat = point[0]
        route_lng = point[1]

        distance = haversine_km(
            lat,
            lng,
            route_lat,
            route_lng
        )

        if distance < minimum_distance:
            minimum_distance = distance

    return minimum_distance

async def real_route(o_lat, o_lng, d_lat, d_lng, mode="walking"):
    profile = "driving" if mode in ("driving", "transit") else "foot"
    # Public OSRM demo servers often support driving; foot may not. We fall back safely.
    url = f"{OSRM_BASE}/{profile}/{o_lng},{o_lat};{d_lng},{d_lat}"
    params = {"overview":"full", "geometries":"geojson", "steps":"true"}
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.get(url, params=params)
            data = r.json()
        if data.get("code") == "Ok" and data.get("routes"):
            route = data["routes"][0]
            points = [[lat, lng] for lng, lat in route["geometry"]["coordinates"]]
            steps = []
            for leg in route.get("legs", []):
                for step in leg.get("steps", []):
                    name = step.get("name") or "the next road"
                    maneuver = step.get("maneuver", {}).get("type", "continue")
                    modifier = step.get("maneuver", {}).get("modifier", "")
                    text = f"{maneuver.capitalize()} {modifier} onto {name}".strip()
                    steps.append({"text": text, "distance_m": round(step.get("distance",0))})
            return {
                "points": points,
                "distance_km": round(route["distance"]/1000, 2),
                "duration_min": max(1, round(route["duration"]/60)),
                "steps": steps[:20] or [{"text":"Continue toward your destination","distance_m":0}],
                "source":"OSRM road routing"
            }
    except Exception:
        pass
    # Reliable fallback: straight-line geometry, clearly labelled as fallback.
    km = haversine_km(o_lat,o_lng,d_lat,d_lng)
    return {
        "points":[[o_lat,o_lng],[d_lat,d_lng]],
        "distance_km":round(km,2),
        "duration_min":max(1,round(km/5*60)),
        "steps":[
            {"text":"Continue toward your destination. Road routing service is unavailable.","distance_m":round(km*500)},
            {"text":"Arrive at your destination.","distance_m":round(km*500)}
        ],
        "source":"Fallback geometry"
    }

def score_route(route, reports=None, safe_place_count=0, current_hour=None):
    """
    Calculate an advisory safety assessment using
    GuardianMap's safety analysis model.

    Existing frontend fields are preserved so that
    the current UI continues to work.
    """

    if reports is None:
        reports = []

    # ------------------------------------------
    # Safety model assessment
    # ------------------------------------------

    assessment = assess_route_safety(
        route=route,
        reports=reports,
        current_hour=current_hour,
        safe_place_count=safe_place_count
    )

    score = assessment["safety_score"]
    risk = assessment["risk_level"]

    # ------------------------------------------
    # Existing GuardianMap UI indicators
    # ------------------------------------------

    lighting_score = min(
        98,
        max(20, score + 4)
    )

    activity_score = max(
        20,
        score - 5
    )

    hazard_exposure = 100 - score

    return {
        "safety_score": score,
        "risk_level": risk,

        "lighting_score": lighting_score,

        "activity_score": activity_score,

        "hazard_exposure": hazard_exposure,

        "explanation": assessment["explanation"],

        # Additional ML/safety information
        "safety_features": assessment["features"]
    }
