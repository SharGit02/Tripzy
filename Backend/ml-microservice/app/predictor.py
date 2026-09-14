"""
Loads the trained model + precomputed lookup artifacts once at process startup
and serves predictions from in-memory state.

At BUILD time, precompute_artifacts.py processes the full 1.66M-row Parquet
and serialises the lightweight lookup structures to models/precomputed_stats.pkl.
At RUNTIME, this module loads only that slim file (~1-3 MB) plus the model
.pkl (~2 MB) — the 50 MB Parquet never enters production RAM.

FastAPI's lifespan hook calls load_artifacts() exactly once, and every request
handler reads the same module-level state.
"""
from __future__ import annotations

from datetime import date

import joblib

from app.feature_engineering import HistoricalStats, align_for_model, create_future_row, find_flights

_model = None
_features: list[str] = []
_categorical_cols: list[str] = []
_categorical_dtypes: dict[str, pd.CategoricalDtype] = {}
_known_routes: set[str] = set()
_city_canonical: dict[str, str] = {}
_stats: HistoricalStats | None = None
_flights_by_route_day: dict[tuple[str, str], list[tuple[str, int]]] = {}
_data_row_count: int = 0
_known_route_count: int = 0


class UnknownRouteError(ValueError):
    """Raised when a city, or the specific origin->destination pair, was
    never observed in the historical dataset."""


class SameOriginDestinationError(ValueError):
    """Raised when origin and destination canonicalize to the same city."""


class NotLoadedError(RuntimeError):
    """Raised if a prediction is requested before load_artifacts() has run."""


def load_artifacts(model_path: str, data_path: str) -> None:
    """
    Loads the model .pkl and — if a precomputed_stats.pkl exists alongside
    the model — that slim artifact instead of the full Parquet.

    Falls back to loading the full Parquet when precomputed_stats.pkl is
    absent (e.g. local development without running precompute_artifacts.py).
    """
    global _model, _features, _categorical_cols, _categorical_dtypes
    global _known_routes, _city_canonical, _stats, _flights_by_route_day
    global _data_row_count, _known_route_count

    # ── 1. Model ──────────────────────────────────────────────────────────────
    print(f"[predictor] Loading model from {model_path}", flush=True)
    package = joblib.load(model_path)
    _model = package["model"]
    _features = package["features"]
    _categorical_cols = package["categorical_cols"]

    # ── 2. Lookup structures ──────────────────────────────────────────────────
    import os
    from pathlib import Path

    stats_path = Path(model_path).parent / "precomputed_stats.pkl"

    if stats_path.exists():
        # Fast path: load precomputed artifact (1-3 MB, no Parquet needed).
        print(f"[predictor] Loading precomputed stats from {stats_path}", flush=True)
        artifact = joblib.load(stats_path)
        _categorical_dtypes   = artifact["categorical_dtypes"]
        _known_routes         = artifact["known_routes"]
        _city_canonical       = artifact["city_canonical"]
        _flights_by_route_day = artifact["flights_by_route_day"]
        sd = artifact["stats"]
        _stats = HistoricalStats(
            global_mean=sd["global_mean"],
            route_mean=sd["route_mean"],
            route_airline_mean=sd["route_airline_mean"],
            route_flight_mean=sd["route_flight_mean"],
            route_month_mean=sd["route_month_mean"],
            route_dow_mean=sd["route_dow_mean"],
            airline_mean=sd["airline_mean"],
        )
        _data_row_count = 0          # Parquet not loaded; count is unavailable
        _known_route_count = len(_known_routes)
        print(
            f"[predictor] Ready — {_known_route_count} routes, "
            f"{len(_city_canonical)} cities (precomputed path).",
            flush=True,
        )
    else:
        # Fallback: build lookups from the raw Parquet (local dev / CI).
        print(
            f"[predictor] precomputed_stats.pkl not found — "
            f"loading full dataset from {data_path}",
            flush=True,
        )

        import pandas as pd  # lazy — only hit in local dev (precomputed_stats.pkl missing)
        data = pd.read_parquet(data_path)
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

        _categorical_dtypes = {
            col: pd.CategoricalDtype(categories=pd.unique(data[col].dropna()))
            for col in _categorical_cols
            if col in data.columns
        }
        _known_routes = set(data["Route"].unique())
        _city_canonical = {}
        for city in pd.concat([data["Origin"], data["Destination"]]).unique():
            _city_canonical[str(city).strip().lower()] = str(city)


        _stats = HistoricalStats(
            global_mean=float(data["FinalFare"].mean()),
            route_mean=data.groupby("Route")["FinalFare"].mean().to_dict(),
            route_airline_mean=data.groupby(["Route", "Airline"])["FinalFare"].mean().to_dict(),
            route_flight_mean=data.groupby(["Route", "FlightNumber"])["FinalFare"].mean().to_dict(),
            route_month_mean=data.groupby(["Route", "Month"])["FinalFare"].mean().to_dict(),
            route_dow_mean=data.groupby(["Route", "DayOfWeek"])["FinalFare"].mean().to_dict(),
            airline_mean=data.groupby("Airline")["FinalFare"].mean().to_dict(),
        )
        unique_flights = data[["Route", "DayOfWeek", "Airline", "FlightNumber"]].drop_duplicates()
        for route, day_of_week, airline, flight_number in unique_flights.itertuples(index=False, name=None):
            _flights_by_route_day.setdefault((route, day_of_week), []).append(
                (airline, int(flight_number))
            )

        _data_row_count = len(data)
        _known_route_count = len(_known_routes)
        print(
            f"[predictor] Ready — {_known_route_count} routes, "
            f"{len(_city_canonical)} cities (full dataset path).",
            flush=True,
        )


def is_loaded() -> bool:
    return _model is not None and _stats is not None


def data_row_count() -> int:
    return _data_row_count


def known_route_count() -> int:
    return _known_route_count


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
    """Single batched model.predict() call for however many rows are given."""
    import pandas as pd  # lazy import — only paid at first prediction
    assert _model is not None
    if not rows:
        return []
    df = pd.DataFrame(rows)
    aligned = align_for_model(df, _features, _categorical_cols, _categorical_dtypes)
    return [round(float(fare), 2) for fare in _model.predict(aligned)]


def predict_fares(origin: str, destination: str, date_: date) -> list[dict]:
    """Every (Airline, FlightNumber) that historically flew this route on this
    weekday, each scored by the model in one batch."""
    import pandas as pd  # lazy import — only paid at first prediction
    assert _stats is not None

    route = f"{origin}_{destination}"
    day_of_week = pd.Timestamp(date_).day_name()
    flights = find_flights(_flights_by_route_day, route, day_of_week)

    rows = [
        create_future_row(_stats, origin, destination, date_, airline, flight_number)
        for airline, flight_number in flights
    ]
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
    return (quote["predicted_fare"], quote["date"], quote["flight_number"])


def predict_window(origin: str, destination: str, start_date: date, window_days: int) -> dict:
    """Arbitrary window prediction. Batches every candidate flight across every
    day into a single model.predict() call."""
    import pandas as pd  # lazy import — only paid at first prediction
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
