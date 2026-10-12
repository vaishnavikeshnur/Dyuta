from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ContactIn(BaseModel):
    name: str
    relation: str = "Trusted contact"
    phone: str

class PlaceIn(BaseModel):
    label: str
    address: str
    latitude: float
    longitude: float

class ReportIn(BaseModel):
    category: str
    severity: int = Field(ge=1, le=5)
    description: str = Field(min_length=4, max_length=1000)
    latitude: float
    longitude: float

class RouteIn(BaseModel):
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    mode: str = "walking"

class TripIn(BaseModel):
    destination_name: str
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    safety_score: float
    distance_km: float
    duration_min: float
    status: str = "completed"

class SettingsIn(BaseModel):
    safety_mode: bool
    dark_mode: bool
