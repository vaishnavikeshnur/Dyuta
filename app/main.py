from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import HTMLResponse
from app.services.safety_ml import assess_route_safety
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime, timedelta
from pydantic import BaseModel
import json
import re
from pathlib import Path
import shutil

from app.core.database import Base, engine, get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.api.deps import current_user
from app.models.models import User, TrustedContact, SavedPlace, SafetyReport, Trip
from app.schemas.schemas import RegisterIn, LoginIn, ContactIn, PlaceIn, ReportIn, RouteIn, TripIn, SettingsIn
from app.services.navigation import (
    real_route,
    score_route,
    haversine_km,
    distance_to_route_km
)
from app.services.safety_ml import assess_route_safety
from app.services.ai import answer

BASE = Path(__file__).resolve().parent
app = FastAPI(title="GuardianMap Major Project", version="1.0.0")
app.mount("/static", StaticFiles(directory=BASE/"static"), name="static")

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

@app.get("/", response_class=HTMLResponse)
async def home():
    return (BASE/"templates"/"index.html").read_text(encoding="utf-8")

@app.get("/api/health")
def health():
    return {"status":"ok","project":"GuardianMap Major Project","time":datetime.utcnow().isoformat()}
# ---------- Authentication ----------

@app.post("/api/auth/register")
def register(
    data: RegisterIn,
    db: Session = Depends(get_db)
):
    email = data.email.strip().lower()

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Please log in."
        )

    user = User(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password)
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({
        "sub": str(user.id)
    })

    return {
        "message": "Account created successfully.",
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "safety_mode": user.safety_mode,
            "dark_mode": user.dark_mode
        }
    }


@app.post("/api/auth/login")
def login(
    data: LoginIn,
    db: Session = Depends(get_db)
):
    email = data.email.strip().lower()

    # bcrypt supports passwords up to 72 bytes
    if len(data.password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password must be 72 bytes or fewer."
        )

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    if not verify_password(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    token = create_access_token({
        "sub": str(user.id)
    })

    return {
        "message": "Login successful.",
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "safety_mode": user.safety_mode,
            "dark_mode": user.dark_mode
        }
    }


@app.get("/api/auth/me")
def me(
    user: User = Depends(current_user)
):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "safety_mode": user.safety_mode,
        "dark_mode": user.dark_mode
    }
# ---------- Trusted Circle ----------

@app.get("/api/contacts")
def list_contacts(
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    contacts = (
        db.query(TrustedContact)
        .filter(TrustedContact.user_id == user.id)
        .all()
    )

    return [
        {
            "id": x.id,
            "name": x.name,
            "relation": x.relation,
            "phone": x.phone
        }
        for x in contacts
    ]


@app.post("/api/contacts")
def add_contact(
    data: ContactIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    try:
        x = TrustedContact(
            user_id=user.id,
            name=data.name,
            relation=data.relation,
            phone=data.phone
        )

        db.add(x)
        db.commit()
        db.refresh(x)

        return {
            "id": x.id,
            "name": x.name,
            "relation": x.relation,
            "phone": x.phone
        }

    except Exception as e:
        db.rollback()
        print("ERROR ADDING CONTACT:", str(e))
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@app.delete("/api/contacts/{contact_id}")
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    x = (
        db.query(TrustedContact)
        .filter(
            TrustedContact.id == contact_id,
            TrustedContact.user_id == user.id
        )
        .first()
    )

    if not x:
        raise HTTPException(404, "Contact not found.")

    db.delete(x)
    db.commit()

    return {"ok": True}
# ---------- Saved Places ----------

@app.get("/api/places")
def list_places(
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    places = (
        db.query(SavedPlace)
        .filter(SavedPlace.user_id == user.id)
        .all()
    )

    return [
        {
            "id": place.id,
            "label": place.label,
            "address": place.address,
            "latitude": place.latitude,
            "longitude": place.longitude
        }
        for place in places
    ]


@app.post("/api/places")
def add_place(
    data: PlaceIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    place = SavedPlace(
        user_id=user.id,
        label=data.label,
        address=data.address,
        latitude=data.latitude,
        longitude=data.longitude
    )

    db.add(place)
    db.commit()
    db.refresh(place)

    return {
        "id": place.id,
        "label": place.label,
        "address": place.address,
        "latitude": place.latitude,
        "longitude": place.longitude
    }


@app.delete("/api/places/{place_id}")
def delete_place(
    place_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    place = (
        db.query(SavedPlace)
        .filter(
            SavedPlace.id == place_id,
            SavedPlace.user_id == user.id
        )
        .first()
    )

    if not place:
        raise HTTPException(
            status_code=404,
            detail="Saved place not found."
        )

    db.delete(place)
    db.commit()

    return {
        "ok": True,
        "message": "Saved place deleted successfully."
    }
# ---------- Safety reports ----------
@app.post("/api/reports/analyze")
def analyze_safety_report(
    payload: dict,
    user: User = Depends(current_user)
):

    description = str(
        payload.get("description", "")
    ).strip()


    if not description:

        raise HTTPException(
            status_code=400,
            detail="Please describe the safety incident."
        )


    if len(description) < 10:

        raise HTTPException(
            status_code=400,
            detail="Please provide more details about the incident."
        )


    prompt = f"""
You are Guardian AI, an AI assistant for a personal safety application.

Analyze the following community safety incident.

Incident description:
"{description}"

Classify it into exactly one of these categories:

- Low lighting
- Harassment
- Unsafe road
- Suspicious activity
- Emergency

Choose a severity from 1 to 5:

1 = Low
2 = Mild
3 = Moderate
4 = High
5 = Critical

Choose a risk level:

LOW
MODERATE
HIGH
CRITICAL

Return ONLY valid JSON.

Use exactly this structure:

{{
    "category": "one allowed category",
    "severity": 1,
    "risk_level": "LOW",
    "confidence": 90,
    "reason": "short explanation",
    "recommendation": "short safety recommendation"
}}

Do not include markdown.
Do not include ```json.
Do not include any extra explanation.
"""


    try:

        ai_result = answer(
            prompt,
            None
        )


        if not isinstance(ai_result, dict):
            raise Exception("Guardian AI returned an invalid response.")

        raw_answer = ai_result.get("answer", "").strip()

        if not raw_answer:
            raise Exception("Guardian AI returned an empty response.")

        if raw_answer.startswith("Guardian AI could not answer"):
            raise Exception(raw_answer)

        raw_answer = re.sub(
            r"^```json\s*",
            "",
            raw_answer,
            flags=re.IGNORECASE
        )


        raw_answer = re.sub(
            r"^```\s*",
            "",
            raw_answer
        )


        raw_answer = re.sub(
            r"\s*```$",
            "",
            raw_answer
        ).strip()


        analysis = json.loads(
            raw_answer
        )


        allowed_categories = [

            "Low lighting",
            "Harassment",
            "Unsafe road",
            "Suspicious activity",
            "Emergency"

        ]


        if (
            analysis.get("category")
            not in allowed_categories
        ):

            analysis["category"] = (
                "Suspicious activity"
            )


        analysis["severity"] = max(
            1,
            min(
                5,
                int(
                    analysis.get(
                        "severity",
                        3
                    )
                )
            )
        )


        allowed_risk_levels = [

            "LOW",
            "MODERATE",
            "HIGH",
            "CRITICAL"

        ]


        risk_level = str(
            analysis.get(
                "risk_level",
                "MODERATE"
            )
        ).upper()


        if (
            risk_level
            not in allowed_risk_levels
        ):

            risk_level = "MODERATE"


        analysis["risk_level"] = (
            risk_level
        )


        analysis["confidence"] = max(
            50,
            min(
                99,
                int(
                    analysis.get(
                        "confidence",
                        75
                    )
                )
            )
        )


        analysis["reason"] = str(
            analysis.get(
                "reason",
                "Guardian AI analyzed the reported incident."
            )
        )


        analysis["recommendation"] = str(
            analysis.get(
                "recommendation",
                "Stay alert and avoid unnecessary risk."
            )
        )


        return analysis


    except Exception as error:

        print(
            "GUARDIAN AI REPORT ANALYSIS ERROR:",
            str(error)
        )


        raise HTTPException(
            status_code=500,
            detail="Guardian AI could not analyze the incident."
        )
@app.post("/api/reports")
async def create_report(
    category: str = Form(...),
    severity: int = Form(...),
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    confidential: bool = Form(False),
    evidence: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    # Validate severity
    if severity < 1 or severity > 5:
        raise HTTPException(
            status_code=400,
            detail="Severity must be between 1 and 5."
        )

    evidence_path = None
    evidence_type = None

    # Handle evidence upload
    if evidence:

        allowed_types = {
            "image/jpeg": "image",
            "image/png": "image",
            "image/webp": "image",
            "video/mp4": "video",
            "video/webm": "video",
            "audio/mpeg": "audio",
            "audio/wav": "audio",
            "audio/webm": "audio"
        }

        if evidence.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Only image, video and audio evidence is allowed."
            )

        # Maximum file size = 25 MB
        MAX_FILE_SIZE = 25 * 1024 * 1024

        file_data = await evidence.read()

        if len(file_data) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="Evidence file must be smaller than 25 MB."
            )

        evidence_type = allowed_types[evidence.content_type]

        # Private evidence folder
        upload_dir = Path("data/private_evidence")
        upload_dir.mkdir(parents=True, exist_ok=True)

        safe_name = (
            f"{user.id}_"
            f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_"
            f"{Path(evidence.filename or 'evidence').name}"
        )

        file_path = upload_dir / safe_name

        with open(file_path, "wb") as buffer:
            buffer.write(file_data)

        evidence_path = str(file_path)

    # Create report
    r = SafetyReport(
        user_id=user.id,
        category=category,
        severity=severity,
        description=description,
        latitude=latitude,
        longitude=longitude,
        confidential=confidential,
        evidence_path=evidence_path,
        evidence_type=evidence_type,
        review_status="pending"
    )

    # Confidential reports stay private
    if confidential:
        r.status = "confidential"
    else:
        r.status = "active"

    db.add(r)
    db.commit()
    db.refresh(r)

    return {
        "status": "created",
        "report_id": r.id,
        "confidential": confidential,
        "evidence_uploaded": evidence_path is not None,
        "review_status": r.review_status,
        "message": (
            "Your confidential report has been securely submitted for review."
            if confidential
            else "Safety report submitted successfully."
        )
    }

@app.get("/api/reports")
def reports(db: Session = Depends(get_db)):
    rows = (
        db.query(SafetyReport)
        .filter(
            SafetyReport.status == "active",
            SafetyReport.confidential == False
        )
        .order_by(SafetyReport.created_at.desc())
        .limit(100)
        .all()
    )

    return [
        {
            "id": r.id,
            "category": r.category,
            "severity": r.severity,
            "description": r.description,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "verified": r.verified,
            "created_at": r.created_at.isoformat()
        }
        for r in rows
    ]
    
@app.get("/api/reports/my-confidential")
def my_confidential_reports(
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    rows = (
        db.query(SafetyReport)
        .filter(
            SafetyReport.user_id == user.id,
            SafetyReport.confidential == True
        )
        .order_by(SafetyReport.created_at.desc())
        .all()
    )

    return [
        {
            "id": r.id,
            "category": r.category,
            "severity": r.severity,
            "description": r.description,
            "review_status": r.review_status,
            "created_at": r.created_at.isoformat(),
            "evidence_uploaded": r.evidence_path is not None
        }
        for r in rows
    ]
@app.get("/api/admin/confidential-reports")
def confidential_reports(
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    # Only admin or authorized members can view confidential reports
    if user.role not in ["admin", "member"]:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to access confidential reports."
        )

    rows = (
        db.query(SafetyReport)
        .filter(SafetyReport.confidential == True)
        .order_by(SafetyReport.created_at.desc())
        .limit(100)
        .all()
    )

    return [
        {
            "id": r.id,
            "category": r.category,
            "severity": r.severity,
            "description": r.description,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "verified": r.verified,
            "evidence_path": r.evidence_path,
            "evidence_type": r.evidence_type,
            "review_status": r.review_status,
            "reviewed_by": r.reviewed_by,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            "created_at": r.created_at.isoformat()
        }
        for r in rows
    ]
# ---------- My Safety Dashboard ----------

@app.get("/api/my-safety")
def my_safety(
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    trips = (
        db.query(Trip)
        .filter(Trip.user_id == user.id)
        .order_by(Trip.created_at.desc())
        .all()
    )

    reports = (
        db.query(SafetyReport)
        .filter(SafetyReport.user_id == user.id)
        .all()
    )

    total_trips = len(trips)

    average_safety_score = (
        round(sum(t.safety_score for t in trips) / total_trips, 1)
        if total_trips > 0
        else 0
    )

    total_distance = round(
        sum(t.distance_km for t in trips), 2
    )

    total_duration = round(
        sum(t.duration_min for t in trips), 1
    )

    emergency_reports = sum(
        1 for r in reports
        if r.category.lower() == "emergency"
    )

    recent_trips = [
        {
            "id": t.id,
            "destination": t.destination_name,
            "safety_score": t.safety_score,
            "distance_km": t.distance_km,
            "duration_min": t.duration_min,
            "status": t.status,
            "created_at": t.created_at.isoformat()
        }
        for t in trips[:10]
    ]

    return {
        "overall_safety_score": average_safety_score,
        "total_trips": total_trips,
        "total_distance_km": total_distance,
        "total_duration_min": total_duration,
        "total_reports": len(reports),
        "emergency_reports": emergency_reports,
        "recent_trips": recent_trips
    }
# ---------- Navigation ----------

@app.post("/api/navigation/route")
async def navigation(
    data: RouteIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):

    # 1. Calculate the real road route
    route = await real_route(
        data.origin_lat,
        data.origin_lng,
        data.destination_lat,
        data.destination_lng,
        data.mode
    )

    # 2. Get active safety reports
    reports = (
        db.query(SafetyReport)
        .filter(SafetyReport.status == "active")
        .all()
    )

        # 3. Find safety reports near the ACTUAL route
    nearby_reports = []

    route_points = route.get("points", [])

    # Safety influence radius = 500 metres
    ROUTE_SAFETY_RADIUS_KM = 0.5

    for report in reports:

        distance_from_route = distance_to_route_km(
            report.latitude,
            report.longitude,
            route_points
        )

        if distance_from_route <= ROUTE_SAFETY_RADIUS_KM:

            report.distance_from_route_km = distance_from_route

            nearby_reports.append(report)

    # 4. Count saved places for the logged-in user
    safe_place_count = (
        db.query(SavedPlace)
        .filter(SavedPlace.user_id == user.id)
        .count()
    )

    # 5. Run GuardianMap ML safety model
    safety = assess_route_safety(
        route=route,
        reports=nearby_reports,
        current_hour=None,
        safe_place_count=safe_place_count
    )

    # 6. Return route + safety assessment
    return {
        **route,
        **safety,
        "nearby_report_count": len(nearby_reports),
        "route_safety_radius_km": ROUTE_SAFETY_RADIUS_KM
    }

# ---------- Safe Haven ----------

@app.post("/api/navigation/safe-haven")
async def safe_haven(payload: dict):

    lat = float(payload["lat"])
    lng = float(payload["lng"])

    # Demo public safe havens
    havens = [
        {
            "name": "Police Assistance Point (Demo)",
            "type": "Police",
            "latitude": lat + 0.008,
            "longitude": lng + 0.006
        },
        {
            "name": "24/7 Hospital (Demo)",
            "type": "Hospital",
            "latitude": lat - 0.006,
            "longitude": lng + 0.007
        },
        {
            "name": "Busy Public Location (Demo)",
            "type": "Public",
            "latitude": lat + 0.004,
            "longitude": lng - 0.006
        },
    ]

    h = min(
        havens,
        key=lambda x: haversine_km(
            lat,
            lng,
            x["latitude"],
            x["longitude"]
        )
    )

    route = await real_route(
        lat,
        lng,
        h["latitude"],
        h["longitude"],
        "walking"
    )

    return {
        "safe_haven": h,
        "route": {
            **route,
            **score_route(route, 0)
        }
    }
@app.post("/api/navigation/safe-haven")
async def safe_haven(payload: dict):
    lat=float(payload["lat"]); lng=float(payload["lng"])
    # Demo public safe havens. In production connect to verified POI data.
    havens=[
        {"name":"Police Assistance Point (Demo)","type":"Police","latitude":lat+0.008,"longitude":lng+0.006},
        {"name":"24/7 Hospital (Demo)","type":"Hospital","latitude":lat-0.006,"longitude":lng+0.007},
        {"name":"Busy Public Location (Demo)","type":"Public","latitude":lat+0.004,"longitude":lng-0.006},
    ]
    h=min(havens,key=lambda x:haversine_km(lat,lng,x["latitude"],x["longitude"]))
    route=await real_route(lat,lng,h["latitude"],h["longitude"],"walking")
    return {"safe_haven":h,"route":{**route,**score_route(route,0)}}

# ---------- AI ----------
@app.post("/api/ai/chat")
def ai_chat(payload:dict):
    question=str(payload.get("question",""))
    route=payload.get("route")
    if not question.strip(): raise HTTPException(400,"Ask Guardian AI a question.")
    return answer(question,route)

# ---------- Trips & analytics ----------
@app.post("/api/trips")
def save_trip(data: TripIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    t=Trip(user_id=user.id,**data.model_dump());db.add(t);db.commit();return {"ok":True}

@app.get("/api/analytics")
def analytics(db: Session = Depends(get_db), user: User = Depends(current_user)):
    trips=db.query(Trip).filter_by(user_id=user.id).all()
    total=len(trips)
    avg=round(sum(x.safety_score for x in trips)/total,1) if total else 0
    night=sum(1 for x in trips if x.created_at.hour>=20 or x.created_at.hour<6)
    emergency=db.query(SafetyReport).filter_by(user_id=user.id,category="Emergency").count()
    return {"total_trips":total,"average_safety_score":avg,"night_trips":night,"emergency_reports":emergency}

# ---------- Settings ----------
@app.put("/api/settings")
def settings(data: SettingsIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    user.safety_mode=data.safety_mode;user.dark_mode=data.dark_mode;db.commit()
    return {"ok":True,"safety_mode":user.safety_mode,"dark_mode":user.dark_mode}
