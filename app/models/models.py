from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    email = Column(String(180), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    safety_mode = Column(Boolean, default=True)
    dark_mode = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    contacts = relationship("TrustedContact", back_populates="user", cascade="all, delete-orphan")
    places = relationship("SavedPlace", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("SafetyReport", back_populates="user", cascade="all, delete-orphan")
    trips = relationship("Trip", back_populates="user", cascade="all, delete-orphan")

class TrustedContact(Base):
    __tablename__ = "trusted_contacts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(120), nullable=False)
    relation = Column(String)
    phone = Column(String(50), nullable=False)
    user = relationship("User", back_populates="contacts")

class SavedPlace(Base):
    __tablename__ = "saved_places"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    label = Column(String(100), nullable=False)
    address = Column(String(300), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    user = relationship("User", back_populates="places")

class SafetyReport(Base):
    __tablename__ = "safety_reports"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    category = Column(String(100), nullable=False)
    severity = Column(Integer, default=3)
    description = Column(Text, nullable=False)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    verified = Column(Boolean, default=False)
    status = Column(String(50), default="active")

    # Confidential reporting
    confidential = Column(Boolean, default=False)

    # Evidence uploaded by the user
    evidence_path = Column(String(500), nullable=True)
    evidence_type = Column(String(50), nullable=True)

    # Review workflow
    review_status = Column(String(50), default="pending")
    reviewed_by = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reports")
class Trip(Base):
    __tablename__ = "trips"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    destination_name = Column(String(300), nullable=False)
    origin_lat = Column(Float, nullable=False)
    origin_lng = Column(Float, nullable=False)
    destination_lat = Column(Float, nullable=False)
    destination_lng = Column(Float, nullable=False)
    safety_score = Column(Float, default=75)
    distance_km = Column(Float, default=0)
    duration_min = Column(Float, default=0)
    status = Column(String(50), default="completed")
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="trips")
