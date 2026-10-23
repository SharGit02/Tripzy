"""Smallest check that the rail wiring still holds: run with
`venv/Scripts/python test_rail_predictor.py` (or pytest)."""
from __future__ import annotations

from datetime import date
from pathlib import Path

from app import rail_predictor

MODEL = Path(__file__).resolve().parent / "models" / "lightgbm_rail_model_3_inputs.pkl"


def test_rail_predictor() -> None:
    rail_predictor.load_artifacts(str(MODEL))
    assert rail_predictor.is_loaded()
    assert rail_predictor.station_count() > 500

    # City names the itinerary actually produces must resolve to real stations.
    assert rail_predictor.canonicalize_station("Delhi") == "NEW DELHI"
    assert rail_predictor.canonicalize_station("goa") == "MADGAON"
    assert rail_predictor.canonicalize_station("Jodhpur") == "JODHPUR JN"  # leading-word match
    assert rail_predictor.canonicalize_station("MUMBAI CENTRAL") == "MUMBAI CENTRAL"

    try:
        rail_predictor.canonicalize_station("Atlantis")
    except rail_predictor.UnknownStationError:
        pass
    else:
        raise AssertionError("unknown station should raise")

    try:
        rail_predictor.canonicalize_route("Delhi", "new delhi")
    except rail_predictor.SameStationError:
        pass
    else:
        raise AssertionError("same station should raise")

    # Every month must map onto a trained SeasonDerived level.
    levels = set(rail_predictor._levels["SeasonDerived"])
    assert all(rail_predictor._season(month) in levels for month in range(1, 13))

    origin, destination = rail_predictor.canonicalize_route("Delhi", "Goa")
    result = rail_predictor.predict_window(origin, destination, date(2026, 11, 5), 7)
    assert len(result["quotes"]) == 7
    assert result["best"] in result["quotes"]
    # log1p target: a sane inverse keeps fares in rupees, not log-space.
    assert all(200 < quote["predicted_fare"] < 200_000 for quote in result["quotes"])
    assert result["best"]["predicted_fare"] == min(q["predicted_fare"] for q in result["quotes"])


if __name__ == "__main__":
    test_rail_predictor()
    print("ok")
