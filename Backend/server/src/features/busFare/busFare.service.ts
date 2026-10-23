import { env } from "../../config/env.js";
import type { PredictBusFareInput } from "./busFare.schema.js";

const DEFAULT_ML_BASE_URL = "http://127.0.0.1:8000";
// A RandomForest row per candidate date, same shape as rail's window scan;
// shares the same cold-start-prone FastAPI process, so it keeps the same
// generous timeout.
const ML_TIMEOUT_MS = 20_000;

type HttpError = Error & { statusCode: number };

function httpError(statusCode: number, message: string): HttpError {
    return Object.assign(new Error(message), { statusCode });
}

// snake_case shape of FastAPI's POST /predict/bus/window, kept private to
// this file so nothing FastAPI-shaped reaches the client.
type MlBusQuote = {
    date: string;
    day_of_week: string;
    predicted_fare: number;
};

type MlBusWindowResponse = {
    origin: string;
    destination: string;
    start_date: string;
    window_days: number;
    quotes: MlBusQuote[];
    best: MlBusQuote | null;
    generated_at: string;
};

export type BusFareQuote = {
    date: string;
    dayOfWeek: string;
    predictedFare: number;
};

export type BusFareWindowResult = {
    origin: string;
    destination: string;
    startDate: string;
    windowDays: number;
    quotes: BusFareQuote[];
    best: BusFareQuote | null;
};

function toQuote(quote: MlBusQuote): BusFareQuote {
    return {
        date: quote.date,
        dayOfWeek: quote.day_of_week,
        predictedFare: quote.predicted_fare,
    };
}

export async function predictBusFareWindow(input: PredictBusFareInput): Promise<BusFareWindowResult> {
    if (!env.FASTAPI_ML_API_KEY) {
        throw httpError(503, "Bus fare prediction service is not configured.");
    }

    const baseUrl = env.FASTAPI_ML_BASE_URL || DEFAULT_ML_BASE_URL;

    let response: Response;
    try {
        response = await fetch(`${baseUrl}/predict/bus/window`, {
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
        throw httpError(503, "Bus fare prediction service did not respond in time.");
    }

    if (response.status === 422) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string };
        throw httpError(422, body.detail || "Origin and destination must be different cities.");
    }
    if (response.status === 401) {
        // A rejected internal key is our misconfiguration, never the caller's.
        throw httpError(503, "Bus fare prediction service credentials were rejected.");
    }
    if (!response.ok) {
        throw httpError(502, "Bus fare prediction service is temporarily unavailable.");
    }

    const body = (await response.json()) as MlBusWindowResponse;

    return {
        origin: body.origin,
        destination: body.destination,
        startDate: body.start_date,
        windowDays: body.window_days,
        quotes: body.quotes.map(toQuote),
        best: body.best ? toQuote(body.best) : null,
    };
}
