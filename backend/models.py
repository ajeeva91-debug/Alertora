"""
ALERTORA AI — Backend Pydantic Schemas & Data Models
"""

from pydantic import BaseModel, Field
from typing import List, Optional

class WeatherNowcastItem(BaseModel):
    hour: str
    time: str
    thunderstorm: int = Field(..., ge=0, le=100)
    hail: int = Field(..., ge=0, le=100)
    cloudburst: int = Field(..., ge=0, le=100)
    lightning: int = Field(..., ge=0, le=100)
    rainfall: int = Field(..., ge=0)
    wind: int = Field(..., ge=0)

class LocationProfile(BaseModel):
    id: str
    name: str
    district: str
    state: str
    lat: float
    lng: float
    currentRisk: str
    temp: float
    humidity: int
    windSpeed: int
    pressure: float
    rainfallRate: int
    nextHazardETA: str
    nextHazardType: str
    nowcast: List[WeatherNowcastItem]

class HazardSummary(BaseModel):
    id: str
    icon: str
    title: str
    probability: int
    riskLevel: str
    eta: str
    description: str
    color: str

class AlertItem(BaseModel):
    id: str
    severity: str
    title: str
    location: str
    timestamp: str
    eta: str
    confidence: int
    hazardTypes: List[str]
    summary: str
    action: str

class EOCDistrictRow(BaseModel):
    district: str
    hazard: str
    risk: str
    eta: str
    confidence: str
    populationAtRisk: str
    infraAtRisk: str
    actionRequired: str
