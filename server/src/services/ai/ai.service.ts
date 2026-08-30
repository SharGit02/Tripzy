/**
 * Public generative-AI service.
 *
 * Everything in the app should call this module rather than talking to Gemini
 * directly, so key rotation, timeouts, and error shaping stay in one place.
 * Swapping providers means rewriting gemini.provider.ts and this file's
 * internals — callers of `generateText` / `generateJson` are unaffected.
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
    /** System instruction steering tone and role. */
    system?: string;
    /** 0 = deterministic, 1 = creative. Defaults to the model's own default. */
    temperature?: number;
    maxOutputTokens?: number;
    model?: string;
    timeoutMs?: number;
}

export interface GenerateResult<T = string> {
    output: T;
    model: string;
    /** Which key in the waterfall served the request (1-based). */
    servedByKey: number;
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

// Built lazily so that importing this module never throws at boot when no keys
// are configured — matching how the weather feature degrades on its own.
let waterfall: KeyWaterfall | null = null;

function getWaterfall(): KeyWaterfall {
    if (!waterfall) {
        waterfall = new KeyWaterfall({
            label: "gemini",
            keys: env.GEMINI_API_KEYS,
            classify: classifyGeminiFailure,
        });
    }
    return waterfall;
}

/** True when at least one key is configured. Cheap enough for a health check. */
export function isAiConfigured(): boolean {
    return env.GEMINI_API_KEYS.length > 0;
}

/** Dam snapshot for health/debug endpoints. Contains no key material. */
export function aiStatus(): ReturnType<KeyWaterfall["status"]> | { label: string; total: 0; ready: 0; gates: [] } {
    if (!isAiConfigured()) {
        return { label: "gemini", total: 0, ready: 0, gates: [] };
    }
    return getWaterfall().status();
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

async function generate(
    options: GenerateOptions,
    extraConfig?: Record<string, unknown>
): Promise<GenerateResult<string>> {
    if (!options.prompt?.trim()) {
        throw Object.assign(new Error("A prompt is required."), { statusCode: 400 });
    }
    if (!isAiConfigured()) {
        throw new NoKeysConfiguredError("gemini");
    }

    const model = options.model ?? env.GEMINI_MODEL;
    const timeoutMs = options.timeoutMs ?? env.GEMINI_TIMEOUT_MS;
    const body = buildBody(options, extraConfig);

    let servedByKey = 0;

    const response = await getWaterfall().run(async (key, context) => {
        servedByKey = context.position;
        return callGemini({ key, model, body, timeoutMs });
    });

    return {
        output: extractText(response),
        model,
        servedByKey,
        usage: toUsage(response),
    };
}

/** Generates free-form text. */
export function generateText(options: GenerateOptions): Promise<GenerateResult<string>> {
    return generate(options);
}

/**
 * Generates structured JSON. Asks Gemini for `application/json` (plus a
 * `responseSchema` when given) so the reply is machine-readable, then parses it.
 *
 * A parse failure is deliberately NOT retried across keys: the key worked fine,
 * the model just produced something unexpected, and spilling would waste the
 * remaining quota on an identical prompt.
 */
export async function generateJson<T = unknown>(options: GenerateJsonOptions<T>): Promise<GenerateResult<T>> {
    const result = await generate(options, {
        responseMimeType: "application/json",
        ...(options.schema ? { responseSchema: options.schema } : {}),
    });

    let parsed: unknown;
    try {
        parsed = JSON.parse(result.output);
    } catch {
        throw new GeminiContentError(
            "INVALID_JSON",
            "Gemini returned a response that was not valid JSON."
        );
    }

    const output = options.validate ? options.validate(parsed) : (parsed as T);
    return { ...result, output };
}

/** Test/manual-recovery hook: closes every gate immediately. */
export function resetAiWaterfall(): void {
    if (waterfall) waterfall.reset();
}
