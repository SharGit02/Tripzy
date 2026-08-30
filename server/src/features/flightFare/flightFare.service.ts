import { env } from "../../config/env.js";
import type { PredictFareInput } from "./flightFare.schema.js";

const DEFAULT_ML_BASE_URL = "http://127.0.0.1:8000";
// A window scan can run up to 30 LightGBM predict calls in one request, so
// weather's 8s upstream timeout is far too tight here.
const ML_TIMEOUT_MS = 20_000;

type HttpError = Error & { statusCode: number };

function httpError(statusCode: number, message: string): HttpError {
    return Object.assign(new Error(message), { statusCode });
}

// Raw shape returned by FastAPI's POST /predict/window — snake_case, kept
// private to this file so nothing downstream ever sees it.
type MlFareQuote = {
    date: string;
    day_of_week: string;
    airline: string;
    flight_number: number;
    predicted_fare: number;
};

type MlPredictWindowResponse = {
    origin: string;
    destination: string;
    start_date: string;
    window_days: number;
    quotes: MlFareQuote[];
    best: MlFareQuote | null;
    days_with_no_flights: string[];
    generated_at: string;
};

export type FlightFareQuote = {
    date: string;
    dayOfWeek: string;
    airline: string;
    flightNumber: number;
    predictedFare: number;
};

export type FlightFareWindowResult = {
    origin: string;
    destination: string;
    startDate: string;
    windowDays: number;
    quotes: FlightFareQuote[];
    best: FlightFareQuote | null;
    daysWithNoFlights: string[];
};

function toQuote(quote: MlFareQuote): FlightFareQuote {
    return {
        date: quote.date,
        dayOfWeek: quote.day_of_week,
        airline: quote.airline,
        flightNumber: quote.flight_number,
        predictedFare: quote.predicted_fare,
    };
}

export async function predictFareWindow(input: PredictFareInput): Promise<FlightFareWindowResult> {
    if (!env.FASTAPI_ML_API_KEY) {
        throw httpError(503, "Flight fare prediction service is not configured.");
    }

    const baseUrl = env.FASTAPI_ML_BASE_URL || DEFAULT_ML_BASE_URL;

    let response: Response;
    try {
        response = await fetch(`${baseUrl}/predict/window`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-API-Key": env.FASTAPI_ML_API_KEY,
            },
            body: JSON.stringify({
                origin: input.origin,
                destination: input.destination,
                start_date: input.startDate,
                window_days: input.windowDays,
            }),
            signal: AbortSignal.timeout(ML_TIMEOUT_MS),
        });
    } catch {
        throw httpError(503, "Flight fare prediction service did not respond in time.");
    }

    if (response.status === 422) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string };
        throw httpError(422, body.detail || "That route has no historical data.");
    }
    if (response.status === 401) {
        // A rejected internal key is our misconfiguration, never the
        // caller's — stays a 5xx, mirroring weather's own 401/403 handling.
        throw httpError(503, "Flight fare prediction service credentials were rejected.");
    }
    if (!response.ok) {
        throw httpError(502, "Flight fare prediction service is temporarily unavailable.");
    }

    const body = (await response.json()) as MlPredictWindowResponse;

    return {
        origin: body.origin,
        destination: body.destination,
        startDate: body.start_date,
        windowDays: body.window_days,
        quotes: body.quotes.map(toQuote),
        best: body.best ? toQuote(body.best) : null,
        daysWithNoFlights: body.days_with_no_flights,
    };
}
