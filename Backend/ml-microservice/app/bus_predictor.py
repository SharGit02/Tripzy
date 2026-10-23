"""
Bus fare prediction, served from lightgbm_bus_model.pkl.

Unlike the rail .pkl (lightgbm_rail_model_3_inputs.pkl — three calendar
features, one date in, one fare out), this model carries a full feature-
engineered pipeline baked into the artifact: 44 columns per row, built from
route metadata, five historical target-encoding maps, five seasonal "expected
demand" context maps, a trailing 7-observation window per route, a recency
map and a global linear trend. The artifact ships every lookup table that
pipeline needs (`feature_artifacts`) so none of it has to be recomputed from
raw data at request time — only reproduced, once, at load time.

`Source`/`Destination`/`Route` are LightGBM native categoricals
(`encoding: "native_cat"` in the artifact), handled exactly like
rail_predictor.py handles its own LightGBM booster: cast to `pd.Categorical`
with the artifact's own category list immediately before `model.predict()`.
LightGBM's sklearn wrapper stores that same category list on the fitted
booster (`booster_.pandas_categorical`) and remaps any DataFrame passed to
`predict()` against it, so passing the exact trained levels at `predict()`
time is what makes a category land on the right trained code - mismatched or
reordered categories would silently score against the wrong split. Unlike
the earlier RandomForest build of this model, this artifact's category lists
carry no explicit "__UNKNOWN__" bucket (50 cities, not 51): an unrecognised
city simply isn't one of the trained categories, so casting it still leaves
every OTHER feature (the historical/context lookups, all of which do ship
explicit fallbacks) doing the real work - see canonicalize_city below.

Two things this module does NOT try to reconstruct exactly, by design:
- The model was trained on a fixed historical window (through ~Sept 2025).
  Every date this service is ever asked about is in the future relative to
  that window, so the "trailing 7 observations" and "most recent fare"
  features always resolve to the SAME fixed value per route — the artifact's
  last 7 points — regardless of which future date is requested. That value is
  precomputed once per route at load time rather than re-scanned per request.
  ponytail: if this model is ever retrained on rolling/live data such that a
  requested date could fall *inside* the observed window, these two features
  would need to become date-aware again (filter to observations strictly
  before the requested date) instead of a fixed per-route constant.
- An unrecognised city or route is not an error (unlike the rail model, which
  has no notion of a station it hasn't seen). The artifact ships explicit
  fallback values for every lookup specifically so an unknown route still
  gets a usable, if generic, prediction — most itinerary destinations won't
  be one of the ~50 cities this particular dataset covers, and refusing to
  answer would make the bus option unavailable for almost every real trip.
"""
from __future__ import annotations

import math
import re
from datetime import date, timedelta

import joblib

_model = None
_features: list[str] = []
_categorical_cols: list[str] = []
_category_levels: dict[str, list[str]] = {}
_log_transform: str | None = None

_global_mean = 0.0
_route_meta: dict[str, tuple[float, float, float, float]] = {}  # route -> (distance, duration, rating, log_count)
_fallback_distance = 0.0
_fallback_duration = 0.0
_fallback_rating = 0.0

# Each target/context map: {key_tuple: value_tuple}. Single-key maps use a
# one-element tuple so every lookup site can use the same `.get(key, ...)`
# shape regardless of how many columns the map is keyed on.
_hist_route: dict[tuple[str], tuple[float, float]] = {}
_hist_route_month: dict[tuple[str, int], tuple[float, float]] = {}
_hist_route_dow: dict[tuple[str, int], tuple[float, float]] = {}
_hist_source: dict[tuple[str], tuple[float, float]] = {}
_hist_destination: dict[tuple[str], tuple[float, float]] = {}

_recent_fare: dict[str, float] = {}
# Precomputed once from the artifact's raw per-route time series (see module
# docstring): mean, population std, and observation count of each route's
# last 7 data points.
_window7: dict[str, tuple[float, float, int]] = {}

_dyn_multiplier_month: dict[tuple[str, int], float] = {}
_dyn_multiplier_dow: dict[tuple[str, int], float] = {}
_occupancy_month: dict[tuple[str, int], float] = {}
_occupancy_dow: dict[tuple[str, int], float] = {}
_seat_availability_month: dict[tuple[str, int], float] = {}
_context_fallbacks: dict[str, float] = {}

_min_date: date | None = None
_trend_start: date | None = None  # month-truncated (day fixed to 1)
_trend_coef: tuple[float, float] = (0.0, 0.0)  # (slope, intercept), log1p space, X = months since _trend_start

_UNKNOWN = "__UNKNOWN__"
_WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
# A handful of common alternate spellings for cities this dataset's 50-odd
# metros use a specific name for. Unlike rail's station aliases, a city this
# table has no entry for is NOT an error here — it simply falls back to the
# model's own "__UNKNOWN__" bucket (see module docstring).
_CITY_ALIASES = {
    "BANGALORE": "BENGALURU",
    "BOMBAY": "MUMBAI",
    "CALCUTTA": "KOLKATA",
    "MADRAS": "CHENNAI",
    "MYSORE": "MYSURU",
    "TRIVANDRUM": "THIRUVANANTHAPURAM",
    "GURGAON": "GURUGRAM",
    "BENARES": "VARANASI",
    "VARANASI CITY": "VARANASI",
    "ALLAHABAD": "PRAYAGRAJ",
    "COCHIN": "KOCHI",
    "VIZAG": "VISAKHAPATNAM",
}


class SameCityError(ValueError):
    """Raised when origin and destination resolve to the same city."""


def load_artifacts(model_path: str) -> None:
    global _model, _features, _categorical_cols, _category_levels, _log_transform
    global _global_mean, _route_meta, _fallback_distance, _fallback_duration, _fallback_rating
    global _hist_route, _hist_route_month, _hist_route_dow, _hist_source, _hist_destination
    global _recent_fare, _window7
    global _dyn_multiplier_month, _dyn_multiplier_dow, _occupancy_month, _occupancy_dow
    global _seat_availability_month, _context_fallbacks
    global _min_date, _trend_start, _trend_coef

    import pandas as pd  # lazy - pandas costs ~100 MB RSS at import

    print(f"[bus] Loading model from {model_path}", flush=True)
    # joblib.load executes arbitrary code for an untrusted pickle, but this is
    # a first-party artifact the project author trained and placed in
    # models/ themselves - the same trust boundary as flight_fare_model.pkl
    # (predictor.py) and lightgbm_rail_model_3_inputs.pkl (rail_predictor.py),
    # both loaded the same way already.
    package = joblib.load(model_path)

    _model = package["model"]
    _features = package["features"]
    _categorical_cols = package["categorical_cols"]
    _category_levels = package["category_levels"]
    _log_transform = package.get("log_transform")

    fa = package["feature_artifacts"]
    _global_mean = float(fa["global_mean"])
    _fallback_distance = float(fa["fallback_distance"])
    _fallback_duration = float(fa["fallback_duration"])
    _fallback_rating = float(fa["fallback_rating"])

    route_meta_df = fa["route_meta"]
    _route_meta = {
        route: (
            float(row.Route_Distance),
            float(row.Route_Duration),
            float(row.Route_Rating),
            math.log1p(float(row.Route_History_Count)),
        )
        for route, row in route_meta_df.iterrows()
    }

    def _map_from(keycols: list[str], df, value_cols: list[str]) -> dict:
        out = {}
        for row in df.itertuples(index=False):
            row_d = row._asdict()
            key = tuple(row_d[col] for col in keycols)
            out[key] = tuple(float(row_d[col]) for col in value_cols)
        return out

    target_maps = fa["target_maps"]
    _hist_route = _map_from(["Route"], target_maps["Hist_Route_Fare"][1], ["Hist_Route_Fare", "Log_Hist_Route_Fare_Count"])
    _hist_route_month = _map_from(
        ["Route", "Travel_Month"], target_maps["Hist_RouteMonth_Fare"][1],
        ["Hist_RouteMonth_Fare", "Log_Hist_RouteMonth_Fare_Count"],
    )
    _hist_route_dow = _map_from(
        ["Route", "Travel_DayOfWeek"], target_maps["Hist_RouteDOW_Fare"][1],
        ["Hist_RouteDOW_Fare", "Log_Hist_RouteDOW_Fare_Count"],
    )
    _hist_source = _map_from(["Source"], target_maps["Hist_Source_Fare"][1], ["Hist_Source_Fare", "Log_Hist_Source_Fare_Count"])
    _hist_destination = _map_from(
        ["Destination"], target_maps["Hist_Destination_Fare"][1],
        ["Hist_Destination_Fare", "Log_Hist_Destination_Fare_Count"],
    )

    _recent_fare = {route: float(fare) for route, fare in fa["recent_map"].items()}

    _window7 = {}
    for route, (_timestamps, values) in fa["route_window"].items():
        tail = values[-7:]
        _window7[route] = (float(tail.mean()), float(tail.std()), int(len(tail)))

    context_maps = fa["context_maps"]
    _dyn_multiplier_month = {
        tuple(row[:2]): float(row[2]) for row in context_maps["Expected_DynamicMultiplier_RouteMonth"][1].itertuples(index=False)
    }
    _dyn_multiplier_dow = {
        tuple(row[:2]): float(row[2]) for row in context_maps["Expected_DynamicMultiplier_RouteDOW"][1].itertuples(index=False)
    }
    _occupancy_month = {
        tuple(row[:2]): float(row[2]) for row in context_maps["Expected_Occupancy_RouteMonth"][1].itertuples(index=False)
    }
    _occupancy_dow = {
        tuple(row[:2]): float(row[2]) for row in context_maps["Expected_Occupancy_RouteDOW"][1].itertuples(index=False)
    }
    _seat_availability_month = {
        tuple(row[:2]): float(row[2]) for row in context_maps["Expected_SeatAvailability_RouteMonth"][1].itertuples(index=False)
    }
    _context_fallbacks = {k: float(v) for k, v in fa["context_fallbacks"].items()}

    _min_date = pd.Timestamp(fa["min_date"]).date()
    trend_start_ts = pd.Timestamp(fa["trend_start"])
    _trend_start = date(trend_start_ts.year, trend_start_ts.month, 1)
    coef = fa["trend_coef"]
    _trend_coef = (float(coef[0]), float(coef[1]))

    print(f"[bus] Ready - {len(_route_meta)} routes, {len(_category_levels.get('Source', []))} cities.", flush=True)


def is_loaded() -> bool:
    return _model is not None


def route_count() -> int:
    return len(_route_meta)


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).strip()).upper()


def canonicalize_city(name: str) -> str:
    """Best-effort match to a trained city name. Falls through to the raw
    (title-cased) input rather than raising when nothing matches — an unknown
    city still gets a prediction via the model's own fallback features (see
    module docstring), it just won't be as specific as a recognised one."""
    key = _normalize(name)
    known = {
        _normalize(level): level
        for levels in (_category_levels.get("Source", []), _category_levels.get("Destination", []))
        for level in levels
        if level != _UNKNOWN
    }

    exact = known.get(key)
    if exact:
        return exact

    alias = _CITY_ALIASES.get(key)
    if alias:
        aliased = known.get(_normalize(alias))
        if aliased:
            return aliased

    # A loose prefix match catches "Bengaluru City" / "Mumbai Central" typed
    # by a traveler; shortest wins, same reasoning as rail_predictor's station
    # matching (so "Agra" doesn't pick an unrelated longer name by accident).
    prefixed = sorted((level for norm, level in known.items() if norm.startswith(f"{key} ")), key=len)
    if prefixed:
        return prefixed[0]

    return name.strip().title()


def canonicalize_route(origin: str, destination: str) -> tuple[str, str]:
    canonical_origin = canonicalize_city(origin)
    canonical_destination = canonicalize_city(destination)
    if _normalize(canonical_origin) == _normalize(canonical_destination):
        raise SameCityError("Origin and destination must be different cities.")
    return canonical_origin, canonical_destination


def _months_between(start: date, end: date) -> int:
    return (end.year - start.year) * 12 + (end.month - start.month)


def _row(origin: str, destination: str, day: date) -> dict:
    route = f"{origin}_{destination}"
    dow = day.weekday()  # Monday=0 .. Sunday=6, matching the rest of this service
    day_of_year = (day - day.replace(month=1, day=1)).days + 1
    quarter = (day.month - 1) // 3 + 1
    week_of_year = day.isocalendar()[1]
    time_index_days = (day - _min_date).days if _min_date else 0

    distance, duration, rating, log_history_count = _route_meta.get(
        route, (_fallback_distance, _fallback_duration, _fallback_rating, 0.0)
    )

    hist_route_fare, log_hist_route_count = _hist_route.get((route,), (_global_mean, 0.0))
    hist_route_month_fare, log_hist_route_month_count = _hist_route_month.get((route, day.month), (_global_mean, 0.0))
    hist_route_dow_fare, log_hist_route_dow_count = _hist_route_dow.get((route, dow), (_global_mean, 0.0))
    hist_source_fare, log_hist_source_count = _hist_source.get((origin,), (_global_mean, 0.0))
    hist_destination_fare, log_hist_destination_count = _hist_destination.get((destination,), (_global_mean, 0.0))

    recent_fare = _recent_fare.get(route, _global_mean)
    window_fare, window_std, window_count = _window7.get(route, (_global_mean, 0.0, 0))

    months_since_trend_start = _months_between(_trend_start, day) if _trend_start else 0
    slope, intercept = _trend_coef
    global_trend_fare = math.expm1(slope * months_since_trend_start + intercept)

    return {
        "Source": origin,
        "Destination": destination,
        "Route": route,
        "Travel_Year": day.year,
        "Travel_Month": day.month,
        "Travel_Day": day.day,
        "Travel_DayOfWeek": dow,
        "Travel_DayOfYear": day_of_year,
        "Travel_Quarter": quarter,
        "Travel_WeekOfYear": week_of_year,
        "Weekend": int(dow >= 5),
        "Time_Index_Days": time_index_days,
        "Month_sin": math.sin(2 * math.pi * day.month / 12),
        "Month_cos": math.cos(2 * math.pi * day.month / 12),
        "DOW_sin": math.sin(2 * math.pi * dow / 7),
        "DOW_cos": math.cos(2 * math.pi * dow / 7),
        "DOY_sin": math.sin(2 * math.pi * day_of_year / 365.25),
        "DOY_cos": math.cos(2 * math.pi * day_of_year / 365.25),
        "Route_Distance": distance,
        "Route_Duration": duration,
        "Route_Rating": rating,
        "Log_Route_History_Count": log_history_count,
        "Hist_Route_Fare": hist_route_fare,
        "Hist_RouteMonth_Fare": hist_route_month_fare,
        "Hist_RouteDOW_Fare": hist_route_dow_fare,
        "Hist_Source_Fare": hist_source_fare,
        "Hist_Destination_Fare": hist_destination_fare,
        "Hist_Route_Recent_Fare": recent_fare,
        "Log_Hist_Route_Fare_Count": log_hist_route_count,
        "Log_Hist_RouteMonth_Fare_Count": log_hist_route_month_count,
        "Log_Hist_RouteDOW_Fare_Count": log_hist_route_dow_count,
        "Log_Hist_Source_Fare_Count": log_hist_source_count,
        "Log_Hist_Destination_Fare_Count": log_hist_destination_count,
        "Expected_DynamicMultiplier_RouteMonth": _dyn_multiplier_month.get(
            (route, day.month), _context_fallbacks.get("Expected_DynamicMultiplier_RouteMonth", 1.0)
        ),
        "Expected_DynamicMultiplier_RouteDOW": _dyn_multiplier_dow.get(
            (route, dow), _context_fallbacks.get("Expected_DynamicMultiplier_RouteDOW", 1.0)
        ),
        "Expected_Occupancy_RouteMonth": _occupancy_month.get(
            (route, day.month), _context_fallbacks.get("Expected_Occupancy_RouteMonth", 0.0)
        ),
        "Expected_Occupancy_RouteDOW": _occupancy_dow.get(
            (route, dow), _context_fallbacks.get("Expected_Occupancy_RouteDOW", 0.0)
        ),
        "Expected_SeatAvailability_RouteMonth": _seat_availability_month.get(
            (route, day.month), _context_fallbacks.get("Expected_SeatAvailability_RouteMonth", 0.0)
        ),
        "Global_Trend_Fare": global_trend_fare,
        "Recent_vs_Route_Ratio": recent_fare / hist_route_fare if hist_route_fare else 1.0,
        "Window7_Route_Fare": window_fare,
        "Window7_Route_Std": window_std,
        "Log_Window7_Route_Count": math.log1p(window_count),
        "Window7_vs_Route_Ratio": window_fare / hist_route_fare if hist_route_fare else 1.0,
    }


def _predict(rows: list[dict]) -> list[float]:
    """One batched model.predict() for the whole window."""
    import pandas as pd  # lazy - pandas costs ~100 MB RSS at import

    assert _model is not None
    if not rows:
        return []

    frame = pd.DataFrame(rows)
    for column in _categorical_cols:
        # Cast to the exact trained category list (see module docstring) -
        # a value not in it becomes NaN, which LightGBM's native categorical
        # splits treat as "missing" rather than erroring or guessing a code.
        frame[column] = pd.Categorical(frame[column], categories=_category_levels.get(column, []))

    predictions = _model.predict(frame[_features])
    inverse = math.expm1 if _log_transform == "log1p" else (lambda value: value)
    return [round(float(inverse(prediction)), 2) for prediction in predictions]


def predict_window(origin: str, destination: str, start_date: date, window_days: int) -> dict:
    """Fare per candidate travel date, plus the cheapest of them. Mirrors the
    flight/rail services' window shape so the product reads the same for
    every transport mode."""
    days = [start_date + timedelta(days=offset) for offset in range(window_days)]
    fares = _predict([_row(origin, destination, day) for day in days])

    quotes = [
        {"date": day, "day_of_week": _WEEKDAYS[day.weekday()], "predicted_fare": fare}
        for day, fare in zip(days, fares)
    ]

    best = min(quotes, key=lambda quote: (quote["predicted_fare"], quote["date"])) if quotes else None
    return {"quotes": quotes, "best": best}
