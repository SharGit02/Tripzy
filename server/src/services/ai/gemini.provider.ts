/**
 * Gemini REST transport for the key waterfall.
 *
 * Raw `fetch` rather than the SDK, for the same reasons as weather.service.ts:
 * no extra dependency, and the waterfall needs to own retry/rotation itself
 * rather than have a client library retry behind its back.
 */
import type { KeyFailure } from "./keyWaterfall.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Error carrying the upstream HTTP status and parsed body for classification. */
export class GeminiHttpError extends Error {
    readonly status: number;
    readonly statusText: string;
    readonly body: unknown;
    readonly retryAfterMs: number | null;

    constructor(status: number, statusText: string, body: unknown, retryAfterMs: number | null) {
        super(`Gemini responded ${status} ${statusText}: ${describeGeminiError(body)}`);
        this.name = "GeminiHttpError";
        this.status = status;
        this.statusText = statusText;
        this.body = body;
        this.retryAfterMs = retryAfterMs;
    }
}

/** Network-level failure: DNS, socket, or our own abort timeout. */
export class GeminiTransportError extends Error {
    readonly timedOut: boolean;

    constructor(message: string, timedOut: boolean) {
        super(message);
        this.name = "GeminiTransportError";
        this.timedOut = timedOut;
    }
}

/**
 * The model produced no usable text — blocked prompt, safety stop, or an empty
 * candidate list. No other key would behave differently, so this classifies as
 * fatal and must not spill down the waterfall.
 */
export class GeminiContentError extends Error {
    readonly statusCode = 422;
    readonly reason: string;

    constructor(reason: string, message: string) {
        super(message);
        this.name = "GeminiContentError";
        this.reason = reason;
    }
}

type GeminiErrorBody = {
    error?: {
        code?: number;
        message?: string;
        status?: string;
        details?: Array<{ reason?: string; "@type"?: string }>;
    };
};

function describeGeminiError(body: unknown): string {
    const message = (body as GeminiErrorBody)?.error?.message;
    return typeof message === "string" && message ? message : "no error message";
}

/** Google's machine-readable reason code, e.g. API_KEY_INVALID. */
function errorReason(body: unknown): string {
    const error = (body as GeminiErrorBody)?.error;
    const detailReason = error?.details?.find((detail) => detail.reason)?.reason;
    return (detailReason || error?.status || "").toUpperCase();
}

/**
 * Maps a Gemini failure onto a waterfall gate decision.
 *
 * The important subtlety: Gemini reports a bad API key as HTTP **400**
 * INVALID_ARGUMENT with `reason: API_KEY_INVALID`, not 401. Classifying purely
 * on status code would mark a revoked key #1 as `fatal` and abort the request
 * instead of spilling to key #2 — the exact failure the waterfall exists to
 * survive. So the body is inspected before the status is trusted.
 */
export function classifyGeminiFailure(error: unknown): KeyFailure {
    if (error instanceof GeminiContentError) {
        return { kind: "fatal", reason: `content:${error.reason}` };
    }

    if (error instanceof GeminiTransportError) {
        return {
            kind: "transient",
            reason: error.timedOut ? "request timed out" : "network error",
        };
    }

    if (error instanceof GeminiHttpError) {
        const reason = errorReason(error.body);

        // Key-shaped rejections, whatever status they arrive under.
        if (
            reason === "API_KEY_INVALID" ||
            reason === "PERMISSION_DENIED" ||
            reason === "API_KEY_SERVICE_BLOCKED" ||
            reason === "ACCESS_TOKEN_EXPIRED" ||
            reason === "UNAUTHENTICATED" ||
            error.status === 401
        ) {
            return { kind: "invalid", reason: `key rejected (${reason || error.status})` };
        }

        // Quota and rate limits — the canonical reason to open a gate.
        if (error.status === 429 || reason === "RESOURCE_EXHAUSTED" || reason === "RATE_LIMIT_EXCEEDED") {
            return {
                kind: "exhausted",
                reason: "quota or rate limit reached",
                ...(error.retryAfterMs !== null ? { cooldownMs: error.retryAfterMs } : {}),
            };
        }

        // 403 that is not key-shaped is still almost always a key/project
        // permission problem, so treat it as a dead key rather than a dead call.
        if (error.status === 403) {
            return { kind: "invalid", reason: `forbidden (${reason || "no reason"})` };
        }

        if (error.status >= 500) {
            return { kind: "transient", reason: `upstream ${error.status}` };
        }

        // Everything else in the 4xx range is our request's fault: unknown
        // model (404), malformed body, oversized payload. Another key cannot
        // help, and trying one would hide the real error behind "all keys
        // failed", so stop the waterfall here.
        return { kind: "fatal", reason: `bad request (${error.status} ${reason || "unknown"})` };
    }

    // Unrecognised throw: treat as transient so the request still gets a second
    // chance, but do not penalise the key beyond the short default cooldown.
    return {
        kind: "transient",
        reason: error instanceof Error ? error.message : "unknown error",
    };
}

function parseRetryAfterMs(header: string | null): number | null {
    if (!header) return null;

    // Retry-After is either delta-seconds or an HTTP date.
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.round(seconds * 1000);
    }

    const date = Date.parse(header);
    if (!Number.isNaN(date)) {
        return Math.max(0, date - Date.now());
    }

    return null;
}

export interface GeminiPart {
    text?: string;
}

export interface GeminiCandidate {
    content?: { parts?: GeminiPart[]; role?: string };
    finishReason?: string;
    safetyRatings?: unknown[];
}

export interface GeminiGenerateResponse {
    candidates?: GeminiCandidate[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };
}

export interface GeminiRequestBody {
    contents: Array<{ role: string; parts: GeminiPart[] }>;
    systemInstruction?: { parts: GeminiPart[] };
    generationConfig?: Record<string, unknown>;
    safetySettings?: unknown[];
}

/**
 * Performs one `generateContent` call with one key. Throws typed errors for the
 * classifier; performs no retrying or rotation of its own.
 */
export async function callGemini(options: {
    key: string;
    model: string;
    body: GeminiRequestBody;
    timeoutMs: number;
}): Promise<GeminiGenerateResponse> {
    const url = `${GEMINI_BASE}/models/${encodeURIComponent(options.model)}:generateContent`;

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Header auth, never a query param: a key in the URL leaks into
                // proxy and access logs.
                "x-goog-api-key": options.key,
            },
            body: JSON.stringify(options.body),
            signal: AbortSignal.timeout(options.timeoutMs),
        });
    } catch (error) {
        const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        throw new GeminiTransportError(
            timedOut ? `Gemini request exceeded ${options.timeoutMs}ms` : "Gemini request failed to send",
            timedOut
        );
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new GeminiHttpError(
            response.status,
            response.statusText,
            payload,
            parseRetryAfterMs(response.headers.get("retry-after"))
        );
    }

    return (payload ?? {}) as GeminiGenerateResponse;
}

/**
 * Pulls the text out of a response, converting "no usable output" into a fatal
 * content error so the waterfall does not spill for something no key can fix.
 */
export function extractText(response: GeminiGenerateResponse): string {
    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) {
        throw new GeminiContentError(blockReason, `Gemini blocked the prompt (${blockReason}).`);
    }

    const candidate = response.candidates?.[0];
    if (!candidate) {
        throw new GeminiContentError("NO_CANDIDATES", "Gemini returned no candidates.");
    }

    const finishReason = candidate.finishReason;
    if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
        throw new GeminiContentError(finishReason, `Gemini stopped early (${finishReason}).`);
    }

    const text = (candidate.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("")
        .trim();

    if (!text) {
        // Common cause on Gemini 3.x: the model burns the whole maxOutputTokens
        // budget on hidden thinking tokens and never reaches visible text. The
        // reply is a valid 200 with an empty part, so say what to change.
        if (finishReason === "MAX_TOKENS") {
            throw new GeminiContentError(
                "MAX_TOKENS",
                "Gemini hit maxOutputTokens before producing any text. Thinking tokens " +
                    "count against that budget, so raise maxOutputTokens (a few thousand " +
                    "is a realistic floor for this model family)."
            );
        }
        throw new GeminiContentError("EMPTY_TEXT", "Gemini returned an empty response.");
    }

    return text;
}
