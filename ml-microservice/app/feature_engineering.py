"""
Feature engineering ported from the training notebook
(Plane_Data_EDA_and_Model_Training.ipynb, cells 58-76).

Pure, stateless functions/dataclasses only - no I/O, no module-level state.
`predictor.py` owns the loaded model/dataset and the precomputed lookup
structures these functions consume.

One deliberate deviation from the notebook's literal implementation:
`get_historical_value()` there re-filters the entire historical DataFrame
(1.66M rows) for every Hist_* feature, for every candidate flight, for every
day scanned - which is fine for a single ad-hoc notebook call but far too
slow for an API serving a 30-day window scan (confirmed by timing: it turned
a single request into a multi-minute one). HistoricalStats below precomputes
the exact same groupby means ONCE at startup, so every lookup at request time
is an O(1) dict access instead of an O(n) scan. The numbers produced are
identical - a precomputed groupby mean equals a mean of the equivalent
boolean-mask filter - only the cost of computing them differs.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import pandas as pd

# The notebook's create_future_row() hard-codes this for every future
# prediction, since no external festival calendar is available for dates
# beyond the training data. The raw parquet's "no festival" value is NaN, but
# an earlier notebook cell runs df["FestivalName"].fillna("No Festival")
# before the training frame is derived from that same df - so this IS a
# trained category, not an unseen one. predictor.load_artifacts() must apply
# the same fillna when reconstructing categorical dtypes, or this would
# silently become an out-of-vocabulary value at inference.
FUTURE_FESTIVAL_NAME = "No Festival"


def get_season(date_obj: date) -> str:
    month = date_obj.month
    if month in (12, 1, 2):
        return "Winter"
    if month in (3, 4, 5):
        return "Summer"
    if month in (6, 7, 8, 9):
        return "Monsoon"
    return "Autumn"  # 10, 11


@dataclass(frozen=True)
class HistoricalStats:
    """Precomputed replacement for repeated get_historical_value() filtering.
    Each accessor mirrors one of the notebook's Hist_* lookups, falling back
    to the dataset-wide mean exactly like get_historical_value did when a
    combination was never observed in training."""

    global_mean: float
    route_mean: dict[str, float]
    route_airline_mean: dict[tuple[str, str], float]
    route_flight_mean: dict[tuple[str, int], float]
    route_month_mean: dict[tuple[str, int], float]
    route_dow_mean: dict[tuple[str, str], float]
    airline_mean: dict[str, float]

    def route(self, route: str) -> float:
        return self.route_mean.get(route, self.global_mean)

    def route_airline(self, route: str, airline: str) -> float:
        return self.route_airline_mean.get((route, airline), self.global_mean)

    def route_flight(self, route: str, flight_number: int) -> float:
        return self.route_flight_mean.get((route, flight_number), self.global_mean)

    def route_month(self, route: str, month: int) -> float:
        return self.route_month_mean.get((route, month), self.global_mean)

    def route_dow(self, route: str, day_of_week: str) -> float:
        return self.route_dow_mean.get((route, day_of_week), self.global_mean)

    def airline(self, airline: str) -> float:
        return self.airline_mean.get(airline, self.global_mean)


def create_future_row(
    stats: HistoricalStats,
    origin: str,
    destination: str,
    date_: date,
    airline: str,
    flight_number: int,
) -> dict:
    """Builds the feature dict for one (route, date, flight) combination,
    matching the notebook's create_future_row(). Returns a plain dict rather
    than a one-row DataFrame so the caller can batch many rows into a single
    pd.DataFrame (and a single model.predict() call) instead of one per row."""
    ts = pd.Timestamp(date_)
    route = f"{origin}_{destination}"
    day_of_week = ts.day_name()
    season = get_season(date_)

    return {
        "Origin": origin,
        "Destination": destination,
        "Route": route,
        "Airline": airline,
        "FlightNumber": flight_number,
        "Year": ts.year,
        "Month": ts.month,
        "Day": ts.day,
        "DayOfYear": ts.dayofyear,
        "DayOfWeek": day_of_week,
        "Weekend": int(ts.dayofweek >= 5),
        "Quarter": ts.quarter,
        "Season": season,
        "FestivalName": FUTURE_FESTIVAL_NAME,
        "Hist_Route_Fare": stats.route(route),
        "Hist_RouteAirline_Fare": stats.route_airline(route, airline),
        "Hist_RouteFlight_Fare": stats.route_flight(route, flight_number),
        "Hist_RouteMonth_Fare": stats.route_month(route, ts.month),
        "Hist_RouteDayOfWeek_Fare": stats.route_dow(route, day_of_week),
        "Hist_Airline_Fare": stats.airline(airline),
        "Hist_Global_Fare": stats.global_mean,
    }


def find_flights(
    flights_by_route_day: dict[tuple[str, str], list[tuple[str, int]]],
    route: str,
    day_of_week: str,
) -> list[tuple[str, int]]:
    """(Airline, FlightNumber) pairs that historically ran on this route and
    weekday (year-agnostic), via the startup-precomputed index. An empty
    result is normal for a sparse route/weekday combination, not an error."""
    return flights_by_route_day.get((route, day_of_week), [])


def align_for_model(
    rows_df: pd.DataFrame,
    features: list[str],
    categorical_cols: list[str],
    categorical_dtypes: dict[str, pd.CategoricalDtype],
) -> pd.DataFrame:
    """Casts categorical columns to the training-time category levels and
    reindexes to the exact feature order the model expects. The notebook did
    this inline (it had X_train in scope); the pkl only ships `features` and
    `categorical_cols`, so the actual category levels are reconstructed by
    the caller (see predictor.load_artifacts) and passed in here."""
    aligned = rows_df.copy()

    for col in categorical_cols:
        dtype = categorical_dtypes.get(col)
        if dtype is not None:
            aligned[col] = pd.Categorical(aligned[col], dtype=dtype)

    return aligned[features]
