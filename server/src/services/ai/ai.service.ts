/**
 * Unified AI Service with Multi-Provider Support (Gemini + NVIDIA + OpenCode Zen)
 *
 * Features:
 * - Primary: OpenCode Zen (Nemotron 3.5 Lightning Free) - free tier
 * - Secondary: NVIDIA API with multiple models
 * - Tertiary: Gemini with key waterfall + model fallback + retry logic
 * - Circuit breakers, deduplication, exponential backoff
 * - Request timeout handling with provider failover
 *  */
import { env } from "../../config/env.js";
import {
    callGemini,
    classifyGeminiFailure,
    extractText,
    GeminiContentError,
    type GeminiGenerateResponse,
    type GeminiRequestBody,
} from "./gemini.provider.js";
import { KeyWaterfall, NoKeysConfiguredError, type KeyFailure } from "./keyWaterfall.js";
import {
    nvidiaProvider,
    classifyNVIDIAError,
    NVIDIA_BASE,
    type NVIDIAModel,
} from "./nvidia.provider.js";
import {
    opencodeProvider,
    classifyOpencodeError,
} from "./opencode.provider.js";

export interface GenerateOptions {
    prompt: string;
    system?: string;
    temperature?: number;
    maxOutputTokens?: number;
    model?: string;
    timeoutMs?: number;
    /** Custom model fallback chain. Defaults to env.GEMINI_MODEL_FALLBACKS or built-in chain. */
    modelFallbacks?: string[];
    /** Max retry attempts for transient failures (default: 3). */
    maxRetries?: number;
    /** Base delay for exponential backoff in ms (default: 1000). */
    baseRetryDelayMs?: number;
    /** Unique request ID for deduplication. */
    requestId?: string;
    /** Preferred provider: "gemini" | "nvidia" | "opencode" | "auto" (default: "auto") */
    preferredProvider?: "gemini" | "nvidia" | "opencode" | "auto";
    /** Enable NVIDIA reasoning mode */
    reasoning?: boolean;
    /** NVIDIA reasoning budget in tokens */
    reasoningBudget?: number;
    /** Force specific provider, bypassing auto-selection */
    forceProvider?: "gemini" | "nvidia" | "opencode";
    /** Stream response (NVIDIA only) */
    stream?: boolean;
    /** Streaming callback for NVIDIA */
    onStreamChunk?: (chunk: { content?: string; reasoning?: string }) => void;
}

export interface GenerateResult<T = string> {
    output: T;
    model: string;
    provider: "gemini" | "nvidia" | "opencode";
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
    /**
     * Gemini `responseSchema` (an OpenAPI-subset schema). When supplied, the
     * model is constrained to this shape instead of merely being asked for JSON.
     */
    schema?: Record<string, unknown>;
    /** Optional post-parse validation, e.g. a zod `parse`. */
    validate?: (value: unknown) => T;
}

interface CircuitBreakerState {
    failures: number;
    lastFailure: number;
    state: "closed" | "open" | "half-open";
}

const circuitBreakers = new Map<string, CircuitBreakerState>();
const inFlightRequests = new Map<string, Promise<any>>();

const DEFAULT_GEMINI_MODEL_FALLBACKS = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
];

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60_000;

const GENERATION_CONFIG = {
    questions: { temperature: 0.4, maxOutputTokens: 1500, timeoutMs: 20_000 },
    itinerary: { temperature: 0.3, maxOutputTokens: 4000, timeoutMs: 30_000 },
    direct: { temperature: 0.3, maxOutputTokens: 4000, timeoutMs: 30_000 },
    regenerate: { temperature: 0.4, maxOutputTokens: 4000, timeoutMs: 30_000 },
};

// Provider fallback chain - Gemini first (primary, faster), then NVIDIA as fallback
const PROVIDER_CHAIN = [
    {
        name: "gemini" as const,
        models: [
            "gemini-3.5-flash",
            "gemini-3.6-flash",
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
            "gemini-2.5-flash",
        ],
        condition: () => true,
    },
    {
        name: "nvidia" as const,
        models: [
            "nvidia/nemotron-3.5-lightning-30b-a3b",
            "nvidia/nemotron-3-ultra-550b-a55b",
            "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
            "deepseek-ai/deepseek-v4-flash-0731",
        ],
        condition: () => true,
    },
];

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
    if (cb.failures >= CIRCUIT_BREAKER_THRESHOLD) {
        cb.state = "open";
    }
}

function recordSuccess(key: string): void {
    const cb = getCircuitBreaker(key);
    if (cb) {
        cb.failures = 0;
        cb.state = "closed";
    }
}

function isCircuitOpen(key: string): boolean {
    const cb = getCircuitBreaker(key);
    if (cb.state === "open") {
        if (Date.now() - cb.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
            cb.state = "half-open";
            return false;
        }
        return true;
    }
    return false;
}

// Built lazily so that importing this module never throws at boot when no keys
// are configured — matching how the weather feature degrades on its own.
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

/** True when at least one key is configured. Cheap enough for a health check. */
export function isAiConfigured(): boolean {
    return env.GEMINI_API_KEYS.length > 0 || Boolean(env.NVIDIA_API_KEY) || Boolean(env.OPENCODE_ZEN_API_KEY);
}

/** Dam snapshot for health/debug endpoints. Contains no key material. */
export function aiStatus(): Record<string, unknown> {
    const geminiConfigured = env.GEMINI_API_KEYS.length > 0;
    const nvidiaConfigured = Boolean(env.NVIDIA_API_KEY);
    const opencodeConfigured = Boolean(env.OPENCODE_ZEN_API_KEY);

    return {
        gemini: geminiConfigured ? getGeminiWaterfall().status() : { label: "gemini", total: 0, ready: 0, gates: [] },
        nvidia: nvidiaConfigured ? { configured: true, model: env.NVIDIA_MODEL, models: nvidiaProvider.getModels() } : { configured: false },
        opencode: opencodeConfigured ? { configured: true, model: env.OPENCODE_ZEN_MODEL, models: opencodeProvider.getModels() } : { configured: false },
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
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getGeminiModelFallbacks(options: GenerateOptions): string[] {
    if (options.modelFallbacks?.length) return options.modelFallbacks;
    if (env.GEMINI_MODEL_FALLBACKS?.length) return env.GEMINI_MODEL_FALLBACKS.split(",").map(s => s.trim());
    const primary = options.model ?? env.GEMINI_MODEL;
    return [primary, ...DEFAULT_GEMINI_MODEL_FALLBACKS.filter(m => m !== primary)];
}

async function attemptGemini(
    model: string,
    options: GenerateOptions,
    extraConfig: Record<string, unknown> | undefined,
    timeoutMs: number,
    body: GeminiRequestBody
): Promise<{ response: GeminiGenerateResponse; servedByKey: number }> {
    let servedByKey = 0;
    const response = await getGeminiWaterfall().run(async (key, context) => {
        servedByKey = context.position;
        return callGemini({ key, model, body, timeoutMs });
    });
    return { response, servedByKey };
}

async function attemptNVIDIA(
    options: GenerateOptions,
    timeoutMs: number,
    body: any
): Promise<{ text: string; model: string; reasoning?: string; usage: any }> {
    if (!env.NVIDIA_API_KEY) {
        throw new Error("NVIDIA API key not configured");
    }

    const result = await nvidiaProvider.generateText(
        { ...options, model: options.model || env.NVIDIA_MODEL },
        env.NVIDIA_API_KEY,
        timeoutMs
    );
    return result;
}

/**
 * Select provider based on request characteristics:
 * - Use OpenCode Zen first (free tier with Nemotron 3.5 Lightning)
 * - Use NVIDIA for: reasoning requests, streaming, image inputs, long context
 * - Use Gemini for: structured JSON, short prompts, cost efficiency
 */
function selectProvider(options: GenerateOptions): "gemini" | "nvidia" | "opencode" {
    if (options.forceProvider) return options.forceProvider;

    // Use OpenCode Zen first (free tier with Nemotron 3.5 Lightning)
    if (env.OPENCODE_ZEN_API_KEY) {
        return "opencode";
    }

    // Use NVIDIA for reasoning, streaming, or image inputs
    if (options.stream || options.reasoning || options.reasoningBudget) {
        return "nvidia";
    }

    // Use NVIDIA for very long contexts (>32k tokens)
    if (options.maxOutputTokens && options.maxOutputTokens > 32000) {
        return "nvidia";
    }

    // Default to Gemini for structured output and general use
    return "gemini";
}

async function generateWithProvider(
    options: GenerateOptions,
    extraConfig?: Record<string, unknown>
): Promise<GenerateResult<string>> {
    if (!options.prompt?.trim()) {
        throw Object.assign(new Error("A prompt is required."), { statusCode: 400 });
    }
    if (!isAiConfigured()) {
        throw new NoKeysConfiguredError("ai");
    }

    const requestId = options.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();

    // Deduplication
    const existing = inFlightRequests.get(requestId);
    if (existing) {
        return existing;
    }

    // Apply generation config based on type
    const configType = options.maxOutputTokens && options.maxOutputTokens <= 1500 ? "questions" : "direct";
    const config = GENERATION_CONFIG[configType] || GENERATION_CONFIG.direct;

    const timeoutMs = options.timeoutMs ?? config.timeoutMs ?? env.GEMINI_TIMEOUT_MS;
    const maxRetries = options.maxRetries ?? 3;
    const baseDelay = options.baseRetryDelayMs ?? 1000;
    const body = buildBody(options, extraConfig);

    console.log(`[AI] 🚀 START | reqId=${requestId} | type=${configType} | tokens~${config.maxOutputTokens} | promptChars=${options.prompt.length}`);

    let lastError: Error | null = null;

    // If forceProvider is set, only try that provider
    let providersToTry = PROVIDER_CHAIN;
    if (options.forceProvider) {
        const forcedConfig = PROVIDER_CHAIN.find(p => p.name === options.forceProvider);
        if (forcedConfig) {
            providersToTry = [forcedConfig];
        }
    }

    for (const providerConfig of providersToTry) {
        if (!providerConfig.condition()) continue;

        const provider = providerConfig.name;
        if (provider === "gemini" && !isGeminiConfigured()) continue;
        if (provider === "nvidia" && !isNVIDIAConfigured()) continue;
        if (String(provider) === "opencode" && !isOpencodeConfigured()) continue;

        // Use provider-specific timeout
        let providerTimeoutMs = timeoutMs;
if (String(provider) === "opencode") {
            providerTimeoutMs = options.timeoutMs ?? env.OPENCODE_ZEN_TIMEOUT_MS;
        } else if (provider === "nvidia") {
            providerTimeoutMs = options.timeoutMs ?? env.NVIDIA_TIMEOUT_MS;
        } else {
            providerTimeoutMs = options.timeoutMs ?? env.GEMINI_TIMEOUT_MS;
        }

        const providerKey = `provider:${provider}`;
        if (isCircuitOpen(providerKey)) {
            console.warn(`[AI] Circuit breaker open for ${provider}, skipping`);
            continue;
        }

        const models = providerConfig.models;

        for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
            const model = models[modelIndex];
            const modelSpecificKey = `${provider}:model:${model}`;

            if (isCircuitOpen(modelSpecificKey)) {
                console.warn(`[AI] Circuit breaker open for ${provider} model ${model}, skipping`);
                continue;
            }

            for (let attempt = 0; attempt <= 3; attempt++) {
                try {
                    let result: GenerateResult<string>;
                    const attemptStart = Date.now();

                    if (provider === "gemini") {
                        // Don't use responseSchema - it fails with complex schemas. Rely on prompt for JSON structure.
                        const { response, servedByKey } = await attemptGemini(
                            model,
                            options,
                            {
                                ...extraConfig,
                                responseMimeType: "application/json",
                            },
                            providerTimeoutMs,
                            body
                        );
                        recordSuccess(modelSpecificKey);

                        result = {
                            output: extractText(response),
                            model,
                            provider: "gemini",
                            servedByKey,
                            attempts: attempt + 1 + (modelIndex * 4),
                            fallbackUsed: modelIndex > 0,
                            providerFallback: false,
                            usage: toUsage(response),
                        };
                    } else if (provider === "nvidia") {
                        const nvidiaResult = await attemptNVIDIA(
                            { ...options, maxOutputTokens: config.maxOutputTokens, temperature: 0.3 },
                            providerTimeoutMs,
                            body
                        );
                        recordSuccess(modelSpecificKey);

                        result = {
                            output: nvidiaResult.text,
                            model: nvidiaResult.model,
                            provider: "nvidia",
                            servedByKey: 1,
                            attempts: attempt + 1 + (modelIndex * 4),
                            fallbackUsed: modelIndex > 0,
                            providerFallback: false,
                            usage: {
                                promptTokens: nvidiaResult.usage.promptTokens,
                                outputTokens: nvidiaResult.usage.completionTokens,
                                totalTokens: nvidiaResult.usage.totalTokens,
                            },
                        };
                    } else if (provider === "opencode") {
                        const opencodeResult = await opencodeProvider.generateText(
                            { ...options, model, maxOutputTokens: config.maxOutputTokens, temperature: 0.3 },
                            env.OPENCODE_ZEN_API_KEY!,
                            providerTimeoutMs,
                            env.OPENCODE_ZEN_BASE_URL
                        );
                        recordSuccess(modelSpecificKey);

                        result = {
                            output: opencodeResult.text,
                            model: opencodeResult.model,
                            provider: "opencode",
                            servedByKey: 1,
                            attempts: attempt + 1 + (modelIndex * 4),
                            fallbackUsed: modelIndex > 0,
                            providerFallback: false,
                            usage: {
                                promptTokens: opencodeResult.usage.promptTokens,
                                outputTokens: opencodeResult.usage.completionTokens,
                                totalTokens: opencodeResult.usage.totalTokens,
                            },
                        };
                    } else {
                        throw new Error(`Unknown provider: ${provider}`);
                    }

                    const duration = Date.now() - startTime;
                    const attemptDuration = Date.now() - attemptStart;
                    console.log(`[AI] ✅ SUCCESS | reqId=${requestId} | provider=${result.provider} | model=${result.model} | key#${result.servedByKey} | attempts=${result.attempts} | ${duration}ms (attempt: ${attemptDuration}ms) | tokens=${result.usage?.totalTokens || "?"}`);

                    inFlightRequests.delete(requestId);
                    return result;
                } catch (error) {
                    lastError = error as Error;
                    const attemptDuration = Date.now() - startTime;

                    const failure = provider === "gemini"
                        ? classifyGeminiFailure(error)
                        : provider === "nvidia"
                            ? classifyNVIDIAError(error)
                            : classifyOpencodeError(error);

                    const isRetriable = failure.kind === "transient" || failure.kind === "exhausted";

                    console.warn(`[AI] ⚠️ FAIL | reqId=${requestId} | provider=${provider} | model=${model} | attempt=${attempt + 1}/4 | kind=${failure.kind} | reason=${failure.reason} | ${attemptDuration}ms`);

                    if (isRetriable && attempt < 3) {
                        const delay = 1000 * Math.pow(2, attempt) + Math.random() * 500;
                        await sleep(delay);
                        continue;
                    }

                    if (failure.kind === "exhausted" || failure.kind === "invalid") {
                        recordFailure(`${provider}:model:${model}`);
                    }

                    if (failure.kind === "fatal") {
                        break;
                    }

                    break;
                }
            }
        }

        console.warn(`[AI] All ${providerConfig.name} models failed, trying fallback provider...`);
    }

    inFlightRequests.delete(requestId);

    const finalError = lastError ?? new Error("All providers, models, and retries exhausted");
    (finalError as any).statusCode = 503;
    throw finalError;
}

function isGeminiConfigured(): boolean {
    return env.GEMINI_API_KEYS.length > 0;
}

function isNVIDIAConfigured(): boolean {
    return Boolean(env.NVIDIA_API_KEY);
}

function isOpencodeConfigured(): boolean {
    return Boolean(env.OPENCODE_ZEN_API_KEY);
}

/** Generates free-form text with multi-provider fallback. */
export function generateText(options: GenerateOptions): Promise<GenerateResult<string>> {
    const promise = generateWithProvider(options);
    if (options.requestId) {
        inFlightRequests.set(options.requestId, promise);
    }
    return promise;
}

/**
 * Generates structured JSON with multi-provider fallback.
 * JSON parse failures are NOT retried across models (wastes quota).
 * Handles thinking tokens in model outputs.
 */
export async function generateJson<T = unknown>(options: GenerateJsonOptions<T>): Promise<GenerateResult<T>> {
    const result = await generateWithProvider(options, {
        responseMimeType: "application/json",
        // Don't send responseSchema - it causes issues with some models
        // We'll rely on the prompt + responseMimeType for JSON structure
    });

let parsed: unknown;
    try {
        let output = result.output.trim();

        console.log("[AI DEBUG] Raw output:", output.slice(0, 500));

        // Strip markdown code blocks
        if (output.startsWith("```")) {
            output = output.replace(/^```(?:json)?\n/, "").replace(/\n```$/, "").trim();
        }

        // Strip thinking tokens (e.g., <think or <thinking>...</thinking>)
        output = output
            .replace(/<think[\s\S]*?<\/think>/gi, "")
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
            .replace(/Here'?s? a thinking process:[\s\S]*?(?=\n\s*\{|\n\s*\[)/gi, "")
            .replace(/Here is my thinking:[\s\S]*?(?=\n\s*\{|\n\s*\[)/gi, "")
            .replace(/Thinking process:[\s\S]*?(?=\n\s*\{|\n\s*\[)/gi, "")
            .replace(/^\s*\n*/g, "") // Remove leading newlines/whitespace
            .trim();

        // Handle case where model returns multiple JSON objects - take the first valid one
        if (!output.startsWith("{") && !output.startsWith("[")) {
            const firstBrace = output.indexOf("{");
            const firstBracket = output.indexOf("[");
            if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
                output = output.slice(firstBrace);
            } else if (firstBracket !== -1) {
                output = output.slice(firstBracket);
            }
        }

        console.log("[AI DEBUG] Cleaned output:", output);

        parsed = JSON.parse(output);
    } catch {
        // Try to extract JSON from the response more aggressively
        const raw = result.output.trim();
        // Find the first { or [ that starts a JSON structure
        const startIdx = Math.min(
            raw.indexOf("{"),
            raw.indexOf("[")
        );
        if (startIdx === -1) {
            console.error("[AI DEBUG] No JSON start marker found");
            throw new GeminiContentError(
                "INVALID_JSON",
                "AI returned a response that was not valid JSON."
            );
        }
        // Find the matching closing bracket
        let depth = 0;
        let endIdx = -1;
        for (let i = startIdx; i < raw.length; i++) {
            const char = raw[i];
            if (char === '{' || char === '[') depth++;
            if (char === '}' || char === ']') {
                depth--;
                if (depth === 0) {
                    endIdx = i + 1;
                    break;
                }
            }
        }
        if (endIdx === -1) {
            console.error("[AI DEBUG] Could not find matching JSON end marker");
            throw new GeminiContentError(
                "INVALID_JSON",
                "AI returned a response that was not valid JSON."
            );
        }
        const jsonStr = raw.slice(startIdx, endIdx);
        try {
            parsed = JSON.parse(jsonStr);
        } catch {
            console.error("[AI DEBUG] Failed to parse extracted JSON:", jsonStr.slice(0, 500));
            throw new GeminiContentError(
                "INVALID_JSON",
                "AI returned a response that was not valid JSON."
            );
        }
    }

    const output = options.validate ? options.validate(parsed) : (parsed as T);
    return { ...result, output };
}

/** Streaming generation (NVIDIA only) */
export async function* generateStream(
    options: GenerateOptions
): AsyncGenerator<{ content?: string; reasoning?: string; done: boolean }> {
    if (!isNVIDIAConfigured()) {
        throw new NoKeysConfiguredError("nvidia");
    }
    if (!env.NVIDIA_API_KEY) {
        throw new NoKeysConfiguredError("nvidia");
    }

    const modelInfo = nvidiaProvider.getModels().find(m => m.id === (options.model || env.NVIDIA_MODEL));
    if (!modelInfo?.supportsStreaming) {
        throw new Error(`Model ${options.model || env.NVIDIA_MODEL} does not support streaming`);
    }

    const body = buildBody(options);
    const streamBody = { ...body, stream: true };

    let response: any;
    try {
        response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${env.NVIDIA_API_KEY}`,
                "Accept": "text/event-stream",
            },
            body: JSON.stringify({ ...body, stream: true }),
            signal: AbortSignal.timeout(options.timeoutMs ?? env.NVIDIA_TIMEOUT_MS),
        });
    } catch (error) {
        throw new Error(`NVIDIA stream request failed: ${error instanceof Error ? error.message : "unknown"}`);
    }

    if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(`NVIDIA streaming failed: ${JSON.stringify(payload)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("No response body reader");
    }

    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") {
                    yield { done: true };
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    const choice = parsed.choices?.[0];
                    if (!choice) continue;

                    if (choice.delta?.content) {
                        yield { content: choice.delta.content, done: false };
                    }
                    if (choice.delta?.reasoning_content) {
                        yield { reasoning: choice.delta.reasoning_content, done: false };
                    }
                } catch {
                    // Ignore parse errors for partial chunks
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/** Test/manual-recovery hook: closes every gate immediately. */
export function resetAiWaterfall(): void {
    if (geminiWaterfall) geminiWaterfall.reset();
    circuitBreakers.clear();
    inFlightRequests.clear();
}

/** Get circuit breaker status for monitoring. */
export function getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    const result: Record<string, CircuitBreakerState> = {};
    for (const [key, state] of circuitBreakers.entries()) {
        result[key] = { ...state };
    }
    return result;
}

export { NoKeysConfiguredError } from "./keyWaterfall.js";
export { classifyGeminiFailure } from "./gemini.provider.js";
export { classifyNVIDIAError } from "./nvidia.provider.js";
export { classifyOpencodeError } from "./opencode.provider.js";
