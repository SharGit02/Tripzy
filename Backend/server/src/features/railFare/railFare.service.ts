import { env } from "../../config/env.js";
import type { PredictRailFareInput } from "./railFare.schema.js";

const DEFAULT_ML_BASE_URL = "http://127.0.0.1:8000";
// One LightGBM row per candidate date (no per-train dimension), so this is a
// much cheaper call than the flight window scan - but it shares the same
// cold-start-prone FastAPI process, so it keeps the same generous timeout.
const ML_TIMEOUT_MS = 20_000;

type HttpError = Error & { statusCode: number };

function httpError(statusCode: number, message: string): HttpError {
    return Object.assign(new Error(message), { statusCode });
}

// snake_case shape of FastAPI's POST /predict/rail/window, kept private to
// this file so nothing FastAPI-shaped reaches the client.
type MlRailQuote = {
    date: string;
    day_of_week: string;
    predicted_fare: number;
};

type MlRailWindowResponse = {
    origin: string;
    destination: string;
    start_date: string;
    window_days: number;
    quotes: MlRailQuote[];
    best: MlRailQuote | null;
    generated_at: string;
};

export type RailFareQuote = {
    date: string;
    dayOfWeek: string;
    predictedFare: number;
};

export type RailFareWindowResult = {
    origin: string;
    destination: string;
    startDate: string;
    windowDays: number;
    quotes: RailFareQuote[];
    best: RailFareQuote | null;
};

function toQuote(quote: MlRailQuote): RailFareQuote {
    return {
        date: quote.date,
        dayOfWeek: quote.day_of_week,
        predictedFare: quote.predicted_fare,
    };
}

export async function predictRailFareWindow(input: PredictRailFareInput): Promise<RailFareWindowResult> {
    if (!env.FASTAPI_ML_API_KEY) {
        throw httpError(503, "Rail fare prediction service is not configured.");
    }

    const baseUrl = env.FASTAPI_ML_BASE_URL || DEFAULT_ML_BASE_URL;

    let response: Response;
    try {
        response = await fetch(`${baseUrl}/predict/rail/window`, {
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
        throw httpError(503, "Rail fare prediction service did not respond in time.");
    }

    if (response.status === 422) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string };
        throw httpError(422, body.detail || "No railway station matched that route.");
    }
    if (response.status === 401) {
        // A rejected internal key is our misconfiguration, never the caller's.
        throw httpError(503, "Rail fare prediction service credentials were rejected.");
    }
    if (!response.ok) {
        throw httpError(502, "Rail fare prediction service is temporarily unavailable.");
    }

    const body = (await response.json()) as MlRailWindowResponse;

    return {
        origin: body.origin,
        destination: body.destination,
        startDate: body.start_date,
        windowDays: body.window_days,
        quotes: body.quotes.map(toQuote),
        best: body.best ? toQuote(body.best) : null,
    };
}
