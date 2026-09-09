/**
 * NVIDIA API provider for AI generation.
 * Supports multiple models with streaming and reasoning capabilities.
 * Priority: fastest non-vision models first for text-only itinerary generation.
 */
export const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";

import type { GenerateOptions, GenerateResult, GenerateJsonOptions } from "./ai.service.js";

export interface NVIDIAModel {
    id: string;
    name: string;
    maxTokens: number;
    supportsStreaming: boolean;
    supportsReasoning: boolean;
    supportsImages: boolean;
}

export const NVIDIA_MODELS: NVIDIAModel[] = [
    // FASTEST: Nemotron 3.5 Lightning 30B - free tier, fast, no vision
    {
        id: "nvidia/nemotron-3.5-lightning-30b-a3b",
        name: "Nemotron 3.5 Lightning 30B",
        maxTokens: 16384,
        supportsStreaming: true,
        supportsReasoning: false,
        supportsImages: false,
    },
    // FAST: Nemotron 3 Ultra 550B - optimized for speed, no vision
    {
        id: "nvidia/nemotron-3-ultra-550b-a55b",
        name: "Nemotron 3 Ultra 550B",
        maxTokens: 16384,
        supportsStreaming: true,
        supportsReasoning: false,
        supportsImages: false,
    },
    // FAST: Nemotron 3 Nano Omni 30B - fast, has vision but we disable it
    {
        id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        name: "Nemotron 3 Nano Omni 30B",
        maxTokens: 65536,
        supportsStreaming: true,
        supportsReasoning: false,
        supportsImages: true,
    },
    // BACKUP: DeepSeek V4 Flash - fast reasoning model
    {
        id: "deepseek-ai/deepseek-v4-flash-0731",
        name: "DeepSeek V4 Flash",
        maxTokens: 16384,
        supportsStreaming: true,
        supportsReasoning: false,
        supportsImages: false,
    },
    // BACKUP: Kimi K3 - good quality
    {
        id: "moonshotai/kimi-k3",
        name: "Kimi K3",
        maxTokens: 16384,
        supportsStreaming: true,
        supportsReasoning: false,
        supportsImages: false,
    },
    // BACKUP: Gemma 4 - vision capable (last resort)
    {
        id: "google/gemma-4-31b-it",
        name: "Gemma 4 31B IT",
        maxTokens: 16384,
        supportsStreaming: true,
        supportsReasoning: false,
        supportsImages: true,
    },
];

export interface NVIDIARequestBody {
    messages: Array<{
        role: string;
        content: string | Array<{
            type: "text" | "image_url";
            text?: string;
            image_url?: { url: string };
        }>;
    }>;
    model: string;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    seed?: number;
    stream?: boolean;
    extra_body?: Record<string, unknown>;
}

export interface NVIDIAResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
            reasoning_content?: string;
        };
        delta?: {
            content?: string;
            reasoning_content?: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export class NVIDIAHttpError extends Error {
    readonly status: number;
    readonly body: unknown;
    readonly retryAfterMs: number | null;

    constructor(status: number, body: unknown, retryAfterMs: number | null) {
        super(`NVIDIA API responded ${status}: ${JSON.stringify(body)}`);
        this.name = "NVIDIAHttpError";
        this.status = status;
        this.body = body;
        this.retryAfterMs = retryAfterMs;
    }
}

export class NVIDIATransportError extends Error {
    readonly timedOut: boolean;

    constructor(message: string, timedOut: boolean) {
        super(message);
        this.name = "NVIDIATransportError";
        this.timedOut = timedOut;
    }
}

export class NVIDIAContentError extends Error {
    readonly statusCode = 422;
    readonly reason: string;

    constructor(reason: string, message: string) {
        super(message);
        this.name = "NVIDIAContentError";
        this.reason = reason;
    }
}

function parseRetryAfterMs(header: string | null): number | null {
    if (!header) return null;
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

function buildNVIDIABody(options: GenerateOptions): NVIDIARequestBody {
    const model = options.model || "google/gemma-4-31b-it";
    const modelInfo = NVIDIA_MODELS.find(m => m.id === model) || NVIDIA_MODELS[0];

    const body: NVIDIARequestBody = {
        model,
        messages: [{ role: "user", content: options.prompt }],
        temperature: options.temperature ?? 1,
        top_p: 0.95,
        max_tokens: options.maxOutputTokens ?? modelInfo.maxTokens,
    };

    if (options.system) {
        body.messages.unshift({ role: "system", content: options.system });
    }

    if (modelInfo.supportsReasoning && (options as any).reasoning) {
        body.extra_body = {
            ...body.extra_body,
            chat_template_kwargs: { thinking: true, reasoning_effort: "high" },
        };
    }

    if (modelInfo.supportsReasoning && (options as any).reasoningBudget) {
        body.extra_body = {
            ...body.extra_body,
            chat_template_kwargs: { enable_thinking: true },
            reasoning_budget: (options as any).reasoningBudget,
        };
    }

    return body;
}

function extractNVIDIAText(response: NVIDIAResponse): string {
    const choice = response.choices?.[0];
    if (!choice) {
        throw new NVIDIAContentError("NO_CHOICES", "NVIDIA returned no choices.");
    }
    const content = choice.message?.content || choice.delta?.content || "";
    if (!content) {
        throw new NVIDIAContentError("EMPTY_CONTENT", "NVIDIA returned empty content.");
    }
    return content.trim();
}

function extractNVIDIAReasoning(response: NVIDIAResponse): string | undefined {
    const choice = response.choices?.[0];
    return choice?.message?.reasoning_content || choice?.delta?.reasoning_content || undefined;
}

async function callNVIDIA(
    apiKey: string,
    body: NVIDIARequestBody,
    timeoutMs: number,
    stream: boolean = false
): Promise<NVIDIAResponse> {
    const url = `${NVIDIA_BASE}/chat/completions`;

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "Accept": stream ? "text/event-stream" : "application/json",
            },
            body: JSON.stringify({ ...body, stream }),
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (error) {
        const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        throw new NVIDIATransportError(
            timedOut ? `NVIDIA request exceeded ${timeoutMs}ms` : "NVIDIA request failed to send",
            timedOut
        );
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new NVIDIAHttpError(
            response.status,
            payload,
            parseRetryAfterMs(response.headers.get("retry-after"))
        );
    }

    return (payload ?? {}) as NVIDIAResponse;
}

async function callNVIDIAStream(
    apiKey: string,
    body: NVIDIARequestBody,
    timeoutMs: number,
    onChunk: (chunk: { content?: string; reasoning?: string }) => void
): Promise<NVIDIAResponse> {
    const url = `${NVIDIA_BASE}/chat/completions`;

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "Accept": "text/event-stream",
            },
            body: JSON.stringify({ ...body, stream: true }),
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (error) {
        const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        throw new NVIDIATransportError(
            timedOut ? `NVIDIA stream request exceeded ${timeoutMs}ms` : "NVIDIA stream request failed to send",
            timedOut
        );
    }

    if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new NVIDIAHttpError(
            response.status,
            payload,
            parseRetryAfterMs(response.headers.get("retry-after"))
        );
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new NVIDIATransportError("No response body reader", false);
    }

    const decoder = new TextDecoder();
    let fullContent = "";
    let fullReasoning = "";
    let finishReason = "";
    let usage: NVIDIAResponse["usage"] | null = null;
    let model = "";
    let id = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;

                try {
                    const parsed = JSON.parse(data);
                    const choice = parsed.choices?.[0];
                    if (!choice) continue;

                    id = parsed.id || id;
                    model = parsed.model || model;
                    finishReason = choice.finish_reason || finishReason;
                    usage = parsed.usage || usage;

                    const delta = choice.delta;
                    if (delta?.content) {
                        fullContent += delta.content;
                        onChunk({ content: delta.content });
                    }
                    if (delta?.reasoning_content) {
                        fullReasoning += delta.reasoning_content;
                        onChunk({ reasoning: delta.reasoning_content });
                    }
                } catch {
                    // Ignore parse errors for partial chunks
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    return {
        id,
        object: "chat.completion",
        created: Date.now(),
        model,
        choices: [{
            index: 0,
            message: {
                role: "assistant",
                content: fullContent,
                reasoning_content: fullReasoning || undefined,
            },
            finish_reason: finishReason || "stop",
        }],
        usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
}

export const nvidiaProvider = {
    async generateText(
        options: GenerateOptions,
        apiKey: string,
        timeoutMs: number
    ): Promise<{ text: string; model: string; reasoning?: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
        const body = buildNVIDIABody(options);
        const response = await callNVIDIA(apiKey, body, timeoutMs, false);
        const reasoning = extractNVIDIAReasoning(response);

        return {
            text: extractNVIDIAText(response),
            model: response.model,
            reasoning,
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
        };
    },

    async generateJson<T = unknown>(
        options: GenerateJsonOptions<T>,
        apiKey: string,
        timeoutMs: number
    ): Promise<{ output: T; model: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
        const body = buildNVIDIABody({
            ...options,
            maxOutputTokens: options.maxOutputTokens ?? 8192,
        });

        const response = await callNVIDIA(apiKey, body, timeoutMs, false);
        let output = extractNVIDIAText(response);

        // Strip markdown code blocks
        if (output.startsWith("```")) {
            output = output.replace(/^```(?:json)?\n/, "").replace(/\n```$/, "").trim();
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(output);
        } catch {
            throw new NVIDIAContentError(
                "INVALID_JSON",
                "NVIDIA returned a response that was not valid JSON."
            );
        }

        const validatedOutput = options.validate ? options.validate(parsed) : (parsed as T);

        return {
            output: validatedOutput,
            model: response.model,
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
        };
    },

    getModels(): NVIDIAModel[] {
        return NVIDIA_MODELS;
    },

    isModelAvailable(modelId: string): boolean {
        return NVIDIA_MODELS.some(m => m.id === modelId);
    },
};

export function classifyNVIDIAError(error: unknown): { kind: "fatal" | "transient" | "exhausted" | "invalid"; reason: string; cooldownMs?: number } {
    if (error instanceof NVIDIAContentError) {
        return { kind: "fatal", reason: `content:${error.reason}` };
    }

    if (error instanceof NVIDIATransportError) {
        return {
            kind: "transient",
            reason: error.timedOut ? "request timed out" : "network error",
        };
    }

    if (error instanceof NVIDIAHttpError) {
        const status = error.status;
        const body = error.body as Record<string, unknown> | null;
        const errorCode = (body?.error as Record<string, unknown>)?.code as string || "";
        const errorMessage = (body?.error as Record<string, unknown>)?.message as string || "";

        if (status === 401 || status === 403 || errorCode === "invalid_api_key" || errorMessage.includes("invalid") || errorMessage.includes("unauthorized")) {
            return { kind: "invalid", reason: `key rejected (${errorCode || status})` };
        }

        if (status === 429 || errorCode === "rate_limit_exceeded" || errorMessage.includes("rate limit")) {
            return {
                kind: "exhausted",
                reason: "rate limit reached",
                ...(error.retryAfterMs !== null ? { cooldownMs: error.retryAfterMs } : {}),
            };
        }

        if (status >= 500) {
            return { kind: "transient", reason: `upstream ${status}` };
        }

        return { kind: "fatal", reason: `bad request (${status} ${errorCode || "unknown"})` };
    }

    return {
        kind: "transient",
        reason: error instanceof Error ? error.message : "unknown error",
    };
}