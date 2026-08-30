"""
Loads the trained model + historical dataset once at process startup and
serves predictions from in-memory state. There is deliberately no class here:
FastAPI's lifespan hook calls load_artifacts() exactly once, and every request
handler reads the same module-level state - mirroring how the notebook's
`data`/`model_hist` globals were used by predict_fares().

Startup precomputes two lookup structures so request-time work is O(1) dict
access plus one batched model.predict() call, instead of re-scanning the
1.66M-row historical frame per flight per day (see feature_engineering.py's
module docstring for why - the naive per-row port was measured taking minutes
for a 30-day window).
"""
from __future__ import annotations

from datetime import date, datetime, timezone

import joblib
import pandas as pd

from app.feature_engineering import HistoricalStats, align_for_model, create_future_row, find_flights

_model = None
_features: list[str] = []
_categorical_cols: list[str] = []
_categorical_dtypes: dict[str, pd.CategoricalDtype] = {}
_data: pd.DataFrame | None = None
_known_routes: set[str] = set()
_city_canonical: dict[str, str] = {}
_stats: HistoricalStats | None = None
_flights_by_route_day: dict[tuple[str, str], list[tuple[str, int]]] = {}


class UnknownRouteError(ValueError):
    """Raised when a city, or the specific origin->destination pair, was
    never observed in the historical dataset."""


class SameOriginDestinationError(ValueError):
    """Raised when origin and destination canonicalize to the same city."""


class NotLoadedError(RuntimeError):
    """Raised if a prediction is requested before load_artifacts() has run."""


def load_artifacts(model_path: str, data_path: str) -> None:
    global _model, _features, _categorical_cols, _categorical_dtypes
    global _data, _known_routes, _city_canonical, _stats, _flights_by_route_day

    package = joblib.load(model_path)
    _model = package["model"]
    _features = package["features"]
    _categorical_cols = package["categorical_cols"]

    data = pd.read_parquet(data_path)
    data["Date"] = pd.to_datetime(data["Date"])

    # Same fillna the training notebook applies to `df` before deriving its
    # `data` frame - FestivalName's NaN rows become "No Festival", which is
    # therefore a real trained category (see feature_engineering.py).
    data["FestivalName"] = data["FestivalName"].fillna("No Festival")

    data["Year"] = data["Date"].dt.year
    data["Month"] = data["Date"].dt.month
    data["Day"] = data["Date"].dt.day
    data["DayOfYear"] = data["Date"].dt.dayofyear
    data["DayOfWeek"] = data["Date"].dt.day_name()
    data["Weekend"] = (data["Date"].dt.dayofweek >= 5).astype(int)
    data["Quarter"] = data["Date"].dt.quarter
    data["Route"] = data["Origin"] + "_" + data["Destination"]

    data = data.sort_values("Date").reset_index(drop=True)
    _data = data

    # The .pkl only ships `features`/`categorical_cols`, not the fitted
    # category levels model_hist was trained against. Reconstructing them by
    # casting the full historical frame is the best available approximation
    # (see knowledge/decisions/0003-flight-fare-ml-microservice.md) - correct
    # as long as the notebook cast categoricals on the full `data` before
    # splitting into train/val/test, which is the standard pattern for
    # `categorical_feature=categorical_cols` passed to LGBMRegressor.fit.
    _categorical_dtypes = {
        col: pd.CategoricalDtype(categories=pd.unique(data[col].dropna()))
        for col in _categorical_cols
        if col in data.columns
    }

    _known_routes = set(data["Route"].unique())
    _city_canonical = {}
    for city in pd.concat([data["Origin"], data["Destination"]]).unique():
        _city_canonical[str(city).strip().lower()] = str(city)

    # Precomputed replacement for get_historical_value()'s repeated filtering
    # - identical means, computed once instead of per (day, flight) call.
    _stats = HistoricalStats(
        global_mean=float(data["FinalFare"].mean()),
        route_mean=data.groupby("Route")["FinalFare"].mean().to_dict(),
        route_airline_mean=data.groupby(["Route", "Airline"])["FinalFare"].mean().to_dict(),
        route_flight_mean=data.groupby(["Route", "FlightNumber"])["FinalFare"].mean().to_dict(),
        route_month_mean=data.groupby(["Route", "Month"])["FinalFare"].mean().to_dict(),
        route_dow_mean=data.groupby(["Route", "DayOfWeek"])["FinalFare"].mean().to_dict(),
        airline_mean=data.groupby("Airline")["FinalFare"].mean().to_dict(),
    )

    # Precomputed replacement for find_flights()'s per-call full-frame filter.
    _flights_by_route_day = {}
    unique_flights = data[["Route", "DayOfWeek", "Airline", "FlightNumber"]].drop_duplicates()
    for route, day_of_week, airline, flight_number in unique_flights.itertuples(index=False, name=None):
        _flights_by_route_day.setdefault((route, day_of_week), []).append((airline, int(flight_number)))


def is_loaded() -> bool:
    return _model is not None and _data is not None


def data_row_count() -> int:
    return 0 if _data is None else len(_data)


def known_route_count() -> int:
    return len(_known_routes)


def canonicalize_route(origin: str, destination: str) -> tuple[str, str]:
    if not is_loaded():
        raise NotLoadedError("Model artifacts have not been loaded yet.")

    origin_key = origin.strip().lower()
    destination_key = destination.strip().lower()

    canonical_origin = _city_canonical.get(origin_key)
    if canonical_origin is None:
        raise UnknownRouteError(f"Unknown origin city: {origin!r}.")

    canonical_destination = _city_canonical.get(destination_key)
    if canonical_destination is None:
        raise UnknownRouteError(f"Unknown destination city: {destination!r}.")

    if canonical_origin == canonical_destination:
        raise SameOriginDestinationError("Origin and destination must differ.")

    route = f"{canonical_origin}_{canonical_destination}"
    if route not in _known_routes:
        raise UnknownRouteError(f"No historical flights found for {canonical_origin} -> {canonical_destination}.")

    return canonical_origin, canonical_destination


def _predict_rows(rows: list[dict]) -> list[float]:
    """Single batched model.predict() call for however many rows are given -
    the key perf win over the notebook's one-DataFrame-per-flight pattern."""
    assert _model is not None
    if not rows:
        return []
    df = pd.DataFrame(rows)
    aligned = align_for_model(df, _features, _categorical_cols, _categorical_dtypes)
    return [round(float(fare), 2) for fare in _model.predict(aligned)]


def predict_fares(origin: str, destination: str, date_: date) -> list[dict]:
    """Ported predict_fares(): every (Airline, FlightNumber) that historically
    flew this route on this weekday, each scored by the model in one batch."""
    assert _stats is not None

    route = f"{origin}_{destination}"
    day_of_week = pd.Timestamp(date_).day_name()
    flights = find_flights(_flights_by_route_day, route, day_of_week)

    rows = [create_future_row(_stats, origin, destination, date_, airline, flight_number) for airline, flight_number in flights]
    predicted_fares = _predict_rows(rows)

    return [
        {
            "date": date_,
            "day_of_week": day_of_week,
            "airline": airline,
            "flight_number": flight_number,
            "predicted_fare": predicted_fare,
        }
        for (airline, flight_number), predicted_fare in zip(flights, predicted_fares)
    ]


def _quote_sort_key(quote: dict) -> tuple:
    # Deterministic tie-break: cheapest first, then earliest date, then
    # lowest flight number - so "best" is stable across repeated calls.
    return (quote["predicted_fare"], quote["date"], quote["flight_number"])


def predict_window(origin: str, destination: str, start_date: date, window_days: int) -> dict:
    """Generalizes the notebook's predict_next_7_days() to an arbitrary
    window. Batches every candidate flight across every day in the window
    into a single model.predict() call, rather than looping predict_fares()
    per day - with up to ~20 flights/day x 30 days, per-day batching alone
    still meant dozens of separate predict() calls per request."""
    assert _stats is not None

    route = f"{origin}_{destination}"
    start_ts = pd.Timestamp(start_date)

    rows: list[dict] = []
    meta: list[tuple[date, str, str, int]] = []
    days_with_no_flights: list[date] = []

    for offset in range(window_days):
        current_date = (start_ts + pd.Timedelta(days=offset)).date()
        day_of_week = pd.Timestamp(current_date).day_name()
        flights = find_flights(_flights_by_route_day, route, day_of_week)

        if not flights:
            days_with_no_flights.append(current_date)
            continue

        for airline, flight_number in flights:
            rows.append(create_future_row(_stats, origin, destination, current_date, airline, flight_number))
            meta.append((current_date, day_of_week, airline, flight_number))

    predicted_fares = _predict_rows(rows)

    quotes = [
        {
            "date": current_date,
            "day_of_week": day_of_week,
            "airline": airline,
            "flight_number": flight_number,
            "predicted_fare": predicted_fare,
        }
        for (current_date, day_of_week, airline, flight_number), predicted_fare in zip(meta, predicted_fares)
    ]

    best = min(quotes, key=_quote_sort_key) if quotes else None

    return {
        "quotes": quotes,
        "best": best,
        "days_with_no_flights": days_with_no_flights,
    }
