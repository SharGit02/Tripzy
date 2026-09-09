/**
 * Gemini-only AI service: key waterfall, model fallbacks, and JSON generation.
 */
import { env } from "../../config/env.js";
import {
    callGemini,
    classifyGeminiFailure,
    extractText,
    GeminiContentError,
    type GeminiGenerateResponse,
    type GeminiRequestBody,
} from "./gemini.provider.js";
import { KeyWaterfall, NoKeysConfiguredError } from "./keyWaterfall.js";

export interface GenerateOptions {
    prompt: string;
    system?: string;
    temperature?: number;
    maxOutputTokens?: number;
    model?: string;
    timeoutMs?: number;
    modelFallbacks?: string[];
    maxRetries?: number;
    baseRetryDelayMs?: number;
    requestId?: string;
}

export interface GenerateResult<T = string> {
    output: T;
    model: string;
    provider: "gemini";
    servedByKey: number;
    attempts: number;
    fallbackUsed: boolean;
    providerFallback: boolean;
    usage: {
        promptTokens: number | null;
        outputTokens: number | null;
        totalTokens: number | null;
    };
}

export interface GenerateJsonOptions<T> extends GenerateOptions {
    schema?: Record<string, unknown>;
    validate?: (value: unknown) => T;
}

interface CircuitBreakerState {
    failures: number;
    lastFailure: number;
    state: "closed" | "open" | "half-open";
}

const circuitBreakers = new Map<string, CircuitBreakerState>();
const inFlightRequests = new Map<string, Promise<GenerateResult<string>>>();

const DEFAULT_GEMINI_MODEL_FALLBACKS = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
];

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60_000;

function getCircuitBreaker(key: string): CircuitBreakerState {
    let cb = circuitBreakers.get(key);
    if (!cb) {
        cb = { failures: 0, lastFailure: 0, state: "closed" };
        circuitBreakers.set(key, cb);
    }
    return cb;
}

function recordFailure(key: string): void {
    const cb = getCircuitBreaker(key);
    cb.failures++;
    cb.lastFailure = Date.now();
    if (cb.failures >= CIRCUIT_BREAKER_THRESHOLD) cb.state = "open";
}

function recordSuccess(key: string): void {
    const cb = getCircuitBreaker(key);
    cb.failures = 0;
    cb.state = "closed";
}

function isCircuitOpen(key: string): boolean {
    const cb = getCircuitBreaker(key);
    if (cb.state !== "open") return false;
    if (Date.now() - cb.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
        cb.state = "half-open";
        return false;
    }
    return true;
}

let geminiWaterfall: KeyWaterfall | null = null;

function getGeminiWaterfall(): KeyWaterfall {
    if (!geminiWaterfall) {
        geminiWaterfall = new KeyWaterfall({
            label: "gemini",
            keys: env.GEMINI_API_KEYS,
            classify: classifyGeminiFailure,
        });
    }
    return geminiWaterfall;
}

export function isAiConfigured(): boolean {
    return env.GEMINI_API_KEYS.length > 0;
}

export function aiStatus(): Record<string, unknown> {
    return {
        gemini: isAiConfigured()
            ? getGeminiWaterfall().status()
            : { label: "gemini", total: 0, ready: 0, gates: [] },
    };
}

function buildBody(options: GenerateOptions, extraConfig?: Record<string, unknown>): GeminiRequestBody {
    const generationConfig: Record<string, unknown> = { ...extraConfig };
    if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = options.maxOutputTokens;

    return {
        contents: [{ role: "user", parts: [{ text: options.prompt }] }],
        ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
        ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
    };
}

function toUsage(response: GeminiGenerateResponse): GenerateResult["usage"] {
    const usage = response.usageMetadata;
    return {
        promptTokens: usage?.promptTokenCount ?? null,
        outputTokens: usage?.candidatesTokenCount ?? null,
        totalTokens: usage?.totalTokenCount ?? null,
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGeminiModelFallbacks(options: GenerateOptions): string[] {
    if (options.modelFallbacks?.length) return options.modelFallbacks;
    if (env.GEMINI_MODEL_FALLBACKS?.length) {
        return env.GEMINI_MODEL_FALLBACKS.split(",").map((s) => s.trim()).filter(Boolean);
    }
    const primary = options.model ?? env.GEMINI_MODEL;
    return [primary, ...DEFAULT_GEMINI_MODEL_FALLBACKS.filter((m) => m !== primary)];
}

async function generateWithGemini(options: GenerateOptions, extraConfig?: Record<string, unknown>): Promise<GenerateResult<string>> {
    if (!options.prompt?.trim()) {
        throw Object.assign(new Error("A prompt is required."), { statusCode: 400 });
    }
    if (!isAiConfigured()) {
        throw new NoKeysConfiguredError("ai");
    }

    const requestId = options.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const existing = inFlightRequests.get(requestId);
    if (existing) return existing;

    const timeoutMs = options.timeoutMs ?? env.GEMINI_TIMEOUT_MS;
    const maxRetries = options.maxRetries ?? 3;
    const body = buildBody(options, extraConfig);
    const models = getGeminiModelFallbacks(options);
    const startTime = Date.now();

    console.log(`[AI] START | reqId=${requestId} | tokens~${options.maxOutputTokens ?? "default"} | promptChars=${options.prompt.length}`);

    const run = (async () => {
        let lastError: Error | null = null;
        let attempts = 0;

        for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
            const model = models[modelIndex];
            const modelKey = `gemini:model:${model}`;
            if (isCircuitOpen(modelKey)) continue;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                attempts++;
                try {
                    let servedByKey = 0;
                    const response = await getGeminiWaterfall().run(async (key, context) => {
                        servedByKey = context.position;
                        return callGemini({ key, model, body, timeoutMs });
                    });
                    recordSuccess(modelKey);
                    const result: GenerateResult<string> = {
                        output: extractText(response),
                        model,
                        provider: "gemini",
                        servedByKey,
                        attempts,
                        fallbackUsed: modelIndex > 0,
                        providerFallback: false,
                        usage: toUsage(response),
                    };
                    console.log(
                        `[AI] SUCCESS | reqId=${requestId} | model=${model} | key#${servedByKey} | ${Date.now() - startTime}ms | tokens=${result.usage.totalTokens ?? "?"}`,
                    );
                    return result;
                } catch (error) {
                    lastError = error as Error;
                    const failure = classifyGeminiFailure(error);
                    console.warn(
                        `[AI] FAIL | reqId=${requestId} | model=${model} | attempt=${attempt + 1} | kind=${failure.kind} | reason=${failure.reason}`,
                    );
                    if ((failure.kind === "transient" || failure.kind === "exhausted") && attempt < maxRetries) {
                        await sleep(1000 * 2 ** attempt + Math.random() * 500);
                        continue;
                    }
                    if (failure.kind === "exhausted" || failure.kind === "invalid") {
                        recordFailure(modelKey);
                    }
                    break;
                }
            }
        }

        const finalError = lastError ?? new Error("All Gemini models and retries exhausted");
        (finalError as Error & { statusCode?: number }).statusCode = 503;
        throw finalError;
    })();

    inFlightRequests.set(requestId, run);
    try {
        return await run;
    } finally {
        inFlightRequests.delete(requestId);
    }
}

export function generateText(options: GenerateOptions): Promise<GenerateResult<string>> {
    return generateWithGemini(options);
}

function extractJsonValue(raw: string): unknown {
    let output = raw.trim();
    if (output.startsWith("```")) {
        output = output.replace(/^```(?:json)?\n?/, "").replace(/\n```$/, "").trim();
    }
    output = output
        .replace(/<think[\s\S]*?<\/think>/gi, "")
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
        .trim();

    if (!output.startsWith("{") && !output.startsWith("[")) {
        const firstBrace = output.indexOf("{");
        const firstBracket = output.indexOf("[");
        if (firstBrace === -1 && firstBracket === -1) {
            throw new GeminiContentError("INVALID_JSON", "AI returned a response that was not valid JSON.");
        }
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            output = output.slice(firstBrace);
        } else {
            output = output.slice(firstBracket);
        }
    }

    try {
        return JSON.parse(output);
    } catch {
        let depth = 0;
        let endIdx = -1;
        for (let i = 0; i < output.length; i++) {
            const char = output[i];
            if (char === "{" || char === "[") depth++;
            if (char === "}" || char === "]") {
                depth--;
                if (depth === 0) {
                    endIdx = i + 1;
                    break;
                }
            }
        }
        if (endIdx === -1) {
            throw new GeminiContentError(
                "INVALID_JSON",
                "AI returned truncated JSON. Try a shorter trip (14 days or fewer).",
            );
        }
        return JSON.parse(output.slice(0, endIdx));
    }
}

export async function generateJson<T = unknown>(options: GenerateJsonOptions<T>): Promise<GenerateResult<T>> {
    const result = await generateWithGemini(options, { responseMimeType: "application/json" });
    console.log("[AI DEBUG] Raw output:", result.output.trim().slice(0, 400));
    const parsed = extractJsonValue(result.output);
    const output = options.validate ? options.validate(parsed) : (parsed as T);
    return { ...result, output };
}

export function resetAiWaterfall(): void {
    if (geminiWaterfall) geminiWaterfall.reset();
    circuitBreakers.clear();
    inFlightRequests.clear();
}

export { NoKeysConfiguredError } from "./keyWaterfall.js";
export { classifyGeminiFailure } from "./gemini.provider.js";
