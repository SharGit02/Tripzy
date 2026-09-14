"""
precompute_artifacts.py — Run once at Docker build time.

Reads the full 50 MB Parquet + .pkl model, extracts the lightweight lookup
structures that the ML service needs at request time, and serialises them
to models/precomputed_stats.pkl (~1–3 MB).

At runtime, predictor.py loads ONLY the model .pkl + this small stats file,
so the 50 MB Parquet never touches production RAM.

Usage (in Dockerfile, after COPY ml-microservice):
    python3 ml-microservice/precompute_artifacts.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import joblib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = os.environ.get(
    "ML_MODEL_PATH", str(BASE_DIR / "models" / "flight_fare_model.pkl")
)
DATA_PATH = os.environ.get(
    "ML_DATA_PATH",
    str(BASE_DIR / "data" / "Indian_Domestic_Flight_Historical_Dataset_FINAL.parquet"),
)
OUT_PATH = BASE_DIR / "models" / "precomputed_stats.pkl"


def main() -> None:
    print(f"[precompute] Loading model from {MODEL_PATH}", flush=True)
    package = joblib.load(MODEL_PATH)
    categorical_cols: list[str] = package["categorical_cols"]

    print(f"[precompute] Loading dataset from {DATA_PATH}", flush=True)
    data = pd.read_parquet(DATA_PATH)
    data["Date"] = pd.to_datetime(data["Date"])
    data["FestivalName"] = data["FestivalName"].fillna("No Festival")
    data["Year"]      = data["Date"].dt.year
    data["Month"]     = data["Date"].dt.month
    data["Day"]       = data["Date"].dt.day
    data["DayOfYear"] = data["Date"].dt.dayofyear
    data["DayOfWeek"] = data["Date"].dt.day_name()
    data["Weekend"]   = (data["Date"].dt.dayofweek >= 5).astype(int)
    data["Quarter"]   = data["Date"].dt.quarter
    data["Route"]     = data["Origin"] + "_" + data["Destination"]
    data = data.sort_values("Date").reset_index(drop=True)

    print("[precompute] Computing lookup structures …", flush=True)

    categorical_dtypes = {
        col: pd.CategoricalDtype(categories=pd.unique(data[col].dropna()))
        for col in categorical_cols
        if col in data.columns
    }

    known_routes: set[str] = set(data["Route"].unique())

    city_canonical: dict[str, str] = {}
    for city in pd.concat([data["Origin"], data["Destination"]]).unique():
        city_canonical[str(city).strip().lower()] = str(city)

    stats_dict = {
        "global_mean":         float(data["FinalFare"].mean()),
        "route_mean":          data.groupby("Route")["FinalFare"].mean().to_dict(),
        "route_airline_mean":  data.groupby(["Route", "Airline"])["FinalFare"].mean().to_dict(),
        "route_flight_mean":   data.groupby(["Route", "FlightNumber"])["FinalFare"].mean().to_dict(),
        "route_month_mean":    data.groupby(["Route", "Month"])["FinalFare"].mean().to_dict(),
        "route_dow_mean":      data.groupby(["Route", "DayOfWeek"])["FinalFare"].mean().to_dict(),
        "airline_mean":        data.groupby("Airline")["FinalFare"].mean().to_dict(),
    }

    flights_by_route_day: dict[tuple[str, str], list[tuple[str, int]]] = {}
    unique_flights = data[["Route", "DayOfWeek", "Airline", "FlightNumber"]].drop_duplicates()
    for route, day_of_week, airline, flight_number in unique_flights.itertuples(index=False, name=None):
        flights_by_route_day.setdefault((route, day_of_week), []).append(
            (airline, int(flight_number))
        )

    artifact = {
        "categorical_dtypes":   categorical_dtypes,
        "known_routes":         known_routes,
        "city_canonical":       city_canonical,
        "stats":                stats_dict,
        "flights_by_route_day": flights_by_route_day,
    }

    print(f"[precompute] Saving to {OUT_PATH}", flush=True)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, OUT_PATH, compress=3)

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"[precompute] Done — {size_kb:.1f} KB written.", flush=True)
    print(f"[precompute] Routes: {len(known_routes)}, Cities: {len(city_canonical)}", flush=True)


if __name__ == "__main__":
    main()
    sys.exit(0)
