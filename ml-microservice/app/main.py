"""
Flight fare prediction ML service.

Internal-only: no CORS middleware is registered on purpose. The only caller is
the Express server's flightFare.service.ts, over the X-Internal-API-Key
header - the browser never talks to this process directly (see
knowledge/decisions/0001-server-side-third-party-api-proxy.md and
0003-flight-fare-ml-microservice.md).
"""
from __future__ import annotations

import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException

from app import predictor
from app.schemas import HealthResponse, PredictWindowRequest, PredictWindowResponse

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = os.environ.get("ML_MODEL_PATH", str(BASE_DIR / "models" / "flight_fare_model.pkl"))
DATA_PATH = os.environ.get(
    "ML_DATA_PATH", str(BASE_DIR / "data" / "Indian_Domestic_Flight_Historical_Dataset_FINAL.parquet")
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    predictor.load_artifacts(MODEL_PATH, DATA_PATH)
    yield


app = FastAPI(title="Tripzee Flight Fare ML Service", lifespan=lifespan)


def verify_internal_key(x_internal_api_key: str = Header(default="")) -> None:
    expected = os.environ.get("ML_INTERNAL_API_KEY")
    if not expected or not secrets.compare_digest(x_internal_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid internal API key.")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_loaded=predictor.is_loaded(),
        data_rows=predictor.data_row_count(),
        known_routes=predictor.known_route_count(),
    )


@app.post("/predict/window", response_model=PredictWindowResponse, dependencies=[Depends(verify_internal_key)])
def predict_window(body: PredictWindowRequest) -> PredictWindowResponse:
    if not predictor.is_loaded():
        raise HTTPException(status_code=503, detail="Model artifacts are not loaded yet.")

    try:
        origin, destination = predictor.canonicalize_route(body.origin, body.destination)
    except (predictor.UnknownRouteError, predictor.SameOriginDestinationError) as error:
        raise HTTPException(status_code=422, detail=str(error))

    result = predictor.predict_window(origin, destination, body.start_date, body.window_days)

    return PredictWindowResponse(
        origin=origin,
        destination=destination,
        start_date=body.start_date,
        window_days=body.window_days,
        generated_at=datetime.now(timezone.utc),
        **result,
    )
