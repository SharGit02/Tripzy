/**
 * OpenCode Zen API provider for AI generation.
 * Uses Nemotron 3.5 Lightning Free model via OpenCode Zen proxy.
 * OpenAI-compatible API.
 */
export const OPENCODE_BASE = "https://opencode.ai/zen/v1";

import type { GenerateOptions } from "./ai.service.js";

export interface OpencodeModel {
    id: string;
    name: string;
    maxTokens: number;
    supportsStreaming: boolean;
    supportsReasoning: boolean;
    supportsImages: boolean;
}

export const OPENCODE_MODELS = [
    {
        id: "nemotron-3.5-lightning-free",
        name: "Nemotron 3.5 Lightning Free",
        maxTokens: 262144,
        supportsStreaming: true,
        supportsReasoning: false,
        supportsImages: false,
    },
];

export interface OpencodeRequestBody {
    model: string;
    messages: Array<{
        role: string;
        content: string | Array<{
            type: "text" | "image_url";
            text?: string;
            image_url?: { url: string };
        }>;
    }>;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stream?: boolean;
}

export interface OpencodeResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export class OpencodeHttpError extends Error {
    readonly status: number;
    readonly body: unknown;
    readonly retryAfterMs: number | null;

    constructor(status: number, body: unknown, retryAfterMs: number | null) {
        super(`OpenCode Zen API responded ${status}: ${JSON.stringify(body)}`);
        this.name = "OpencodeHttpError";
        this.status = status;
        this.body = body;
        this.retryAfterMs = retryAfterMs;
    }
}

export class OpencodeTransportError extends Error {
    readonly timedOut: boolean;

    constructor(message: string, timedOut: boolean) {
        super(message);
        this.name = "OpencodeTransportError";
        this.timedOut = timedOut;
    }
}

export class OpencodeContentError extends Error {
    readonly statusCode = 422;
    readonly reason: string;

    constructor(reason: string, message: string) {
        super(message);
        this.name = "OpencodeContentError";
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

function buildOpencodeBody(options: GenerateOptions, model: string): OpencodeRequestBody {
    return {
        model,
        messages: [
            ...(options.system ? [{ role: "system", content: options.system }] : []),
            { role: "user", content: options.prompt },
        ],
        temperature: options.temperature ?? 0.3,
        top_p: 0.95,
        max_tokens: options.maxOutputTokens ?? 4000,
        stream: false,
    };
}

function extractOpencodeText(response: any): string {
    const choice = response.choices?.[0];
    if (!choice) {
        throw new Error("OpenCode Zen returned no choices.");
    }
    const content = choice.message?.content || "";
    if (!content) {
        throw new Error("OpenCode Zen returned empty content.");
    }
    return content.trim();
}

async function callOpencode(
    apiKey: string,
    body: any,
    timeoutMs: number,
    baseUrl: string
): Promise<any> {
    const url = `${baseUrl}/chat/completions`;

    let response: Response;
    try {
        response = await fetch(`${body.model ? "https://opencode.ai/zen/v1" : "https://opencode.ai/zen/v1"}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (error) {
        const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        throw new Error(
            timedOut ? `OpenCode Zen request exceeded ${timeoutMs}ms` : "OpenCode Zen request failed to send",
        );
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            `OpenCode Zen API responded ${response.status}: ${JSON.stringify(payload)}`,
        );
    }

    return (payload ?? {}) as any;
}

export const opencodeProvider = {
    async generateText(
        options: GenerateOptions,
        apiKey: string,
        timeoutMs: number,
        baseUrl: string = "https://opencode.ai/zen/v1"
    ): Promise<{ text: string; model: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
        const model = options.model || "nemotron-3.5-lightning-free";
        const body = {
            model,
            messages: [
                ...(options.system ? [{ role: "system", content: options.system }] : []),
                { role: "user", content: options.prompt },
            ],
            temperature: options.temperature ?? 0.3,
            top_p: 0.95,
            max_tokens: options.maxOutputTokens ?? 4000,
        };

        const response = await callOpencode(apiKey, body, timeoutMs, "https://opencode.ai/zen/v1");

        const choice = response.choices?.[0];
        if (!choice) {
            throw new Error("OpenCode Zen returned no choices.");
        }
        const content = choice.message?.content || "";
        if (!content) {
            throw new Error("OpenCode Zen returned empty content.");
        }

        return {
            text: content.trim(),
            model: response.model,
            usage: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
            },
        };
    },

    getModels() {
        return [
            {
                id: "nemotron-3.5-lightning-free",
                name: "Nemotron 3.5 Lightning Free",
                maxTokens: 262144,
                supportsStreaming: true,
                supportsReasoning: false,
                supportsImages: false,
            },
        ];
    },
};

export function classifyOpencodeError(error: unknown): { kind: "fatal" | "transient" | "exhausted" | "invalid"; reason: string; cooldownMs?: number } {
    const message = error instanceof Error ? error.message : String(error);

    // Check for authentication errors
    if (message.includes("401") || message.includes("Unauthorized") || message.includes("authentication failed")) {
        return { kind: "invalid", reason: "key rejected (401)" };
    }

    // Check for rate limiting
    if (message.includes("429") || message.includes("rate limit") || message.includes("quota")) {
        return {
            kind: "exhausted",
            reason: "rate limit or quota reached",
        };
    }

    // Check for server errors
    if (message.includes("500") || message.includes("502") || message.includes("503")) {
        return { kind: "transient", reason: `upstream error` };
    }

    // Check for timeout
    if (message.includes("timeout") || message.includes("timed out")) {
        return { kind: "transient", reason: "request timed out" };
    }

    // Default to transient
    return { kind: "transient", reason: message };
}