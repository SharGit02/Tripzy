"""
Rail fare prediction, served from lightgbm_rail_model_3_inputs.pkl.

Deliberately much thinner than predictor.py (flights): the rail .pkl ships its
own category levels and its feature contract is "only route/calendar features
reproducible from the three user inputs" (origin, destination, journey_date),
so there is no historical frame, no precomputed aggregates and no per-train
identity to look up. One date in, one fare out.
"""
from __future__ import annotations

import math
import re
from datetime import date, timedelta

import joblib

_model = None
_feature_cols: list[str] = []
_categorical_cols: list[str] = []
_levels: dict[str, list[str]] = {}
_log_transform: str | None = None
# Upper-cased station name -> the exact level string the model was trained on.
_station_canonical: dict[str, str] = {}

_WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
_UNKNOWN = "__UNKNOWN__"

# Cities travellers type that are NOT station names in the training data, or
# have no railhead of their own and are reached via a neighbouring one. Keys
# are upper-cased; values must be exact trained levels.
_CITY_STATION_ALIASES = {
    "DELHI": "NEW DELHI",
    "GOA": "MADGAON",
    "PANJIM": "MADGAON",
    "PANAJI": "MADGAON",
    "CALANGUTE": "MADGAON",
    "ANJUNA": "MADGAON",
    "PALOLEM": "MADGAON",
    "MUMBAI": "MUMBAI CENTRAL",
    "BOMBAY": "MUMBAI CENTRAL",
    "BENGALURU": "BANGALORE CITY JN",
    "KOLKATA": "HOWRAH JN",
    "CALCUTTA": "HOWRAH JN",
    "CHENNAI": "CHENNAI CENTRAL",
    "MADRAS": "CHENNAI CENTRAL",
    "HYDERABAD": "SECUNDERABAD JN",
    "KOCHI": "ERNAKULAM JN",
    "COCHIN": "ERNAKULAM JN",
    "KERALA": "ERNAKULAM JN",
    "MUNNAR": "ERNAKULAM JN",
    "THIRUVANANTHAPURAM": "TRIVANDRUM CENTRAL",
    "TRIVANDRUM": "TRIVANDRUM CENTRAL",
    "VARKALA": "TRIVANDRUM CENTRAL",
    # Places with no rail link of their own: the station travellers book to.
    "SRINAGAR": "JAMMU TAWI",
    "GULMARG": "JAMMU TAWI",
    "PAHALGAM": "JAMMU TAWI",
    "KASHMIR": "JAMMU TAWI",
    "LADAKH": "JAMMU TAWI",
    "LEH": "JAMMU TAWI",
    "MANALI": "CHANDIGARH",
    "DHARAMSHALA": "CHANDIGARH",
    "HIMACHAL": "CHANDIGARH",
    "HIMACHAL PRADESH": "CHANDIGARH",
    "RAJASTHAN": "JAIPUR",
    "PUSHKAR": "AJMER JN",
    "KASHI": "VARANASI JN",
    "MEGHALAYA": "GUWAHATI",
    "SHILLONG": "GUWAHATI",
    "CHERRAPUNJI": "GUWAHATI",
    "NASIK": "DEVLALI",
    "NASHIK": "DEVLALI",
    "VISAKHAPATNAM": "VISHAKAPATNAM",
    "VIZAG": "VISHAKAPATNAM",
    "MYSURU": "MYSORE JN",
    "PONDICHERRY": "PUDUCHERRY",
    "PONDY": "PUDUCHERRY",
}


class UnknownStationError(ValueError):
    """Raised when a city/station name cannot be mapped to a trained level."""


class SameStationError(ValueError):
    """Raised when origin and destination resolve to the same station."""


def load_artifacts(model_path: str) -> None:
    global _model, _feature_cols, _categorical_cols, _levels, _log_transform, _station_canonical

    print(f"[rail] Loading model from {model_path}", flush=True)
    package = joblib.load(model_path)
    _model = package["model"]
    _feature_cols = package["feature_cols"]
    _categorical_cols = package["categorical_cols"]
    _levels = package["category_levels_lgb"]
    _log_transform = package.get("log_transform")

    _station_canonical = {}
    for column in ("origin", "destination"):
        for level in _levels.get(column, []):
            if level.startswith("__"):
                continue
            _station_canonical.setdefault(_normalize(level), level)

    print(f"[rail] Ready - {len(_station_canonical)} stations.", flush=True)


def is_loaded() -> bool:
    return _model is not None


def station_count() -> int:
    return len(_station_canonical)


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).strip().upper())


def canonicalize_station(name: str) -> str:
    """City or station name -> exact trained level. Exact match first, then the
    alias table, then a leading-word match ("JODHPUR" -> "JODHPUR JN")."""
    if not is_loaded():
        raise RuntimeError("Rail model has not been loaded yet.")

    key = _normalize(name)

    exact = _station_canonical.get(key)
    if exact:
        return exact

    alias = _CITY_STATION_ALIASES.get(key)
    if alias and _normalize(alias) in _station_canonical:
        return _station_canonical[_normalize(alias)]

    # "JODHPUR" -> "JODHPUR JN". Shortest wins, so "AGRA" picks "AGRA CANTT"
    # over "AGRA FORT"; only a leading match counts, or "PATNA" would happily
    # resolve to "MACHILIPATNAM".
    prefixed = sorted(
        (level for normalized, level in _station_canonical.items() if normalized.startswith(f"{key} ")),
        key=len,
    )
    if prefixed:
        return prefixed[0]

    raise UnknownStationError(f"No railway station found for {name!r}.")


def canonicalize_route(origin: str, destination: str) -> tuple[str, str]:
    canonical_origin = canonicalize_station(origin)
    canonical_destination = canonicalize_station(destination)
    if canonical_origin == canonical_destination:
        raise SameStationError("Origin and destination must be different stations.")
    return canonical_origin, canonical_destination


def _season(month: int) -> str:
    # The .pkl's SeasonDerived levels are Autumn/Spring/Summer/Winter (plus the
    # __MISSING__/__UNKNOWN__ sentinels) - no Monsoon, unlike the flight model's
    # get_season - so this is the standard meteorological 4-way split. Keep the
    # map exhaustive: anything outside the trained levels silently becomes
    # __UNKNOWN__ instead of failing.
    if month in (12, 1, 2):
        return "Winter"
    if month in (3, 4, 5):
        return "Spring"
    if month in (6, 7, 8):
        return "Summer"
    return "Autumn"


def _row(origin: str, destination: str, day: date) -> dict:
    day_of_year = (day - day.replace(month=1, day=1)).days + 1
    quarter = (day.month - 1) // 3 + 1
    return {
        "origin": origin,
        "destination": destination,
        "month": day.month,
        "quarter": quarter,
        "Year": day.year,
        "Month": day.month,
        "Day": day.day,
        "DayOfYear": day_of_year,
        "Quarter": quarter,
        "Weekend": int(day.weekday() >= 5),
        "SeasonDerived": _season(day.month),
        "Origin_Destination": f"{origin}_{destination}",
    }


def _predict(rows: list[dict]) -> list[float]:
    """One batched Booster.predict() for the whole window."""
    import pandas as pd  # lazy - pandas costs ~100 MB RSS at import

    assert _model is not None
    if not rows:
        return []

    frame = pd.DataFrame(rows)
    for column in _categorical_cols:
        levels = _levels[column]
        # Map out-of-vocabulary values onto the sentinel the model was trained
        # with, rather than letting pd.Categorical turn them into NaN.
        known = set(levels)
        frame[column] = pd.Categorical(
            [value if value in known else _UNKNOWN for value in frame[column]],
            categories=levels,
        )

    predictions = _model.predict(frame[_feature_cols])
    inverse = math.expm1 if _log_transform == "log1p" else (lambda value: value)
    return [round(float(inverse(prediction)), 2) for prediction in predictions]


def predict_window(origin: str, destination: str, start_date: date, window_days: int) -> dict:
    """Fare per candidate travel date, plus the cheapest of them. Mirrors the
    flight service's window shape so the product reads the same for both modes,
    minus the per-flight dimension the rail model has no notion of."""
    days = [start_date + timedelta(days=offset) for offset in range(window_days)]
    fares = _predict([_row(origin, destination, day) for day in days])

    quotes = [
        {"date": day, "day_of_week": _WEEKDAYS[day.weekday()], "predicted_fare": fare}
        for day, fare in zip(days, fares)
    ]

    best = min(quotes, key=lambda quote: (quote["predicted_fare"], quote["date"])) if quotes else None
    return {"quotes": quotes, "best": best}
