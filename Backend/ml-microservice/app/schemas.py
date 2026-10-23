from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


class PredictWindowRequest(BaseModel):
    origin: str = Field(min_length=2, max_length=60)
    destination: str = Field(min_length=2, max_length=60)
    start_date: date
    window_days: int = Field(default=30, ge=1, le=90)

    @field_validator("origin", "destination")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()


class FareQuote(BaseModel):
    date: date
    day_of_week: str
    airline: str
    flight_number: int
    predicted_fare: float


class PredictWindowResponse(BaseModel):
    origin: str
    destination: str
    start_date: date
    window_days: int
    quotes: list[FareQuote]
    best: FareQuote | None
    days_with_no_flights: list[date]
    generated_at: datetime


class RailPredictWindowRequest(BaseModel):
    origin: str = Field(min_length=2, max_length=80)
    destination: str = Field(min_length=2, max_length=80)
    start_date: date
    window_days: int = Field(default=30, ge=1, le=90)

    @field_validator("origin", "destination")
    @classmethod
    def _strip_rail(cls, value: str) -> str:
        return value.strip()


class RailFareQuote(BaseModel):
    date: date
    day_of_week: str
    predicted_fare: float


class RailPredictWindowResponse(BaseModel):
    origin: str
    destination: str
    start_date: date
    window_days: int
    quotes: list[RailFareQuote]
    best: RailFareQuote | None
    generated_at: datetime


class BusPredictWindowRequest(BaseModel):
    origin: str = Field(min_length=2, max_length=80)
    destination: str = Field(min_length=2, max_length=80)
    start_date: date
    window_days: int = Field(default=30, ge=1, le=90)

    @field_validator("origin", "destination")
    @classmethod
    def _strip_bus(cls, value: str) -> str:
        return value.strip()


class BusFareQuote(BaseModel):
    date: date
    day_of_week: str
    predicted_fare: float


class BusPredictWindowResponse(BaseModel):
    origin: str
    destination: str
    start_date: date
    window_days: int
    quotes: list[BusFareQuote]
    best: BusFareQuote | None
    generated_at: datetime


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    data_rows: int
    known_routes: int
    rail_model_loaded: bool = False
    rail_stations: int = 0
    bus_model_loaded: bool = False
    bus_routes: int = 0


class ErrorResponse(BaseModel):
    detail: str
