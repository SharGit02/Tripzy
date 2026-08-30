/**
 * Waterfall dam key rotation.
 *
 * Keys are held in strict priority order. Every call starts at the top of the
 * waterfall (key #1) and only spills down to the next key when the one above it
 * fails in a way that another key could plausibly fix — that is the "gate
 * opening". A key whose gate is open is marked as *overflowing* for a cooldown
 * window and is skipped entirely on subsequent calls, so an exhausted key does
 * not cost every later request a wasted round-trip. Once its cooldown expires
 * the gate closes and the waterfall returns to preferring it again.
 *
 * This module is deliberately provider-agnostic: it knows nothing about Gemini,
 * HTTP, or JSON. Callers supply the keys and a `classify` function that decides
 * what a given error means. Any other keyed, quota-metered API can reuse it.
 */

/**
 * What a failed attempt means for the key that produced it.
 *
 * - `exhausted` — the key is rate limited or out of quota. Another key fixes it.
 * - `invalid`   — the key is rejected outright (revoked, malformed, no access).
 *                 Another key fixes it, but this one stays down much longer.
 * - `transient` — upstream hiccup (5xx, socket error, timeout). Not the key's
 *                 fault, so it earns only a token cooldown.
 * - `fatal`     — the *request* is wrong (bad params, unknown model, blocked
 *                 content). No key can fix it, so the waterfall stops dead and
 *                 rethrows rather than burning every remaining key.
 */
export type FailureKind = "exhausted" | "invalid" | "transient" | "fatal";

/** A cooling failure kind — everything except `fatal`, which never cools down. */
export type CoolingFailureKind = Exclude<FailureKind, "fatal">;

export interface KeyFailure {
    kind: FailureKind;
    /** Short human-readable reason, safe to log. Must never contain the key. */
    reason: string;
    /**
     * Overrides the configured cooldown for this failure, in milliseconds.
     * Use it to honour a server-supplied hint such as `Retry-After`.
     */
    cooldownMs?: number;
}

export interface AttemptContext {
    /** 1-based position in the waterfall, matching the env var suffix. */
    position: number;
    /** Human label such as `key #2`. Safe to log. */
    label: string;
    /** True when this key was tried despite still being in cooldown. */
    lastResort: boolean;
}

export interface AttemptEvent extends AttemptContext {
    outcome: "success" | FailureKind;
    reason?: string;
    durationMs: number;
}

export interface WaterfallOptions {
    /** Name used in logs and errors, e.g. "gemini". */
    label: string;
    /** Keys in priority order. Index 0 is tried first. */
    keys: string[];
    classify: (error: unknown) => KeyFailure;
    /** Per-kind cooldown overrides, in milliseconds. */
    cooldownMs?: Partial<Record<CoolingFailureKind, number>>;
    /** Observability hook. Defaults to a console logger. */
    onAttempt?: (event: AttemptEvent) => void;
}

const DEFAULT_COOLDOWN_MS: Record<CoolingFailureKind, number> = {
    // Rate limits are usually per-minute windows; a minute is long enough to
    // stop hammering and short enough that key #1 comes back quickly.
    exhausted: 60_000,
    // A rejected key is a configuration problem, not a busy one. Park it for a
    // long while so it stops adding latency to every request.
    invalid: 30 * 60_000,
    // Not the key's fault, so barely penalise it.
    transient: 5_000,
};

/** Thrown when every key in the waterfall has been tried and all of them failed. */
export class AllKeysExhaustedError extends Error {
    /** Rendered by the shared error middleware. */
    readonly statusCode = 503;
    readonly attempts: AttemptEvent[];

    constructor(label: string, attempts: AttemptEvent[]) {
        const summary = attempts.map((a) => `${a.label}: ${a.outcome} (${a.reason})`).join("; ");
        super(`All ${attempts.length} ${label} API keys failed. ${summary}`);
        this.name = "AllKeysExhaustedError";
        this.attempts = attempts;
    }
}

/** Thrown at construction when no keys were supplied at all. */
export class NoKeysConfiguredError extends Error {
    readonly statusCode = 503;

    constructor(label: string) {
        super(`No ${label} API keys are configured.`);
        this.name = "NoKeysConfiguredError";
    }
}

/**
 * Masks a key for logs: only the last four characters survive. Never log or
 * return the raw key from anywhere in this module.
 */
function maskKey(key: string): string {
    return key.length <= 8 ? "****" : `****${key.slice(-4)}`;
}

interface Gate {
    position: number;
    key: string;
    label: string;
    masked: string;
    /** Epoch ms until which this key is overflowing and should be skipped. */
    overflowUntil: number;
    lastFailure: { kind: FailureKind; reason: string; at: string } | null;
    successes: number;
    failures: number;
}

export interface GateStatus {
    position: number;
    key: string;
    state: "ready" | "overflowing";
    overflowingForMs: number;
    successes: number;
    failures: number;
    lastFailure: Gate["lastFailure"];
}

export class KeyWaterfall {
    private readonly label: string;
    private readonly gates: Gate[];
    private readonly classify: (error: unknown) => KeyFailure;
    private readonly cooldowns: Record<CoolingFailureKind, number>;
    private readonly onAttempt: (event: AttemptEvent) => void;

    constructor(options: WaterfallOptions) {
        const keys = options.keys.map((key) => key.trim()).filter(Boolean);
        if (keys.length === 0) {
            throw new NoKeysConfiguredError(options.label);
        }

        this.label = options.label;
        this.classify = options.classify;
        this.cooldowns = { ...DEFAULT_COOLDOWN_MS, ...options.cooldownMs };
        this.onAttempt = options.onAttempt ?? defaultAttemptLogger(options.label);

        this.gates = keys.map((key, index) => ({
            position: index + 1,
            key,
            label: `key #${index + 1}`,
            masked: maskKey(key),
            overflowUntil: 0,
            lastFailure: null,
            successes: 0,
            failures: 0,
        }));
    }

    get size(): number {
        return this.gates.length;
    }

    /**
     * Runs `operation` against the highest-priority key that is not currently
     * overflowing, spilling down the waterfall on each recoverable failure.
     *
     * Resolves with the first successful result. Rethrows immediately on a
     * `fatal` failure, and throws `AllKeysExhaustedError` if every key fails.
     */
    async run<T>(operation: (key: string, context: AttemptContext) => Promise<T>): Promise<T> {
        const attempts: AttemptEvent[] = [];

        for (const { gate, lastResort } of this.attemptOrder()) {
            const context: AttemptContext = {
                position: gate.position,
                label: gate.label,
                lastResort,
            };
            const startedAt = Date.now();

            try {
                const result = await operation(gate.key, context);
                gate.successes += 1;
                // A key that just worked is demonstrably healthy, so close its
                // gate early instead of waiting out a cooldown set by a blip.
                gate.overflowUntil = 0;
                this.emit({ ...context, outcome: "success", durationMs: Date.now() - startedAt }, attempts);
                return result;
            } catch (error) {
                const failure = this.classify(error);
                gate.failures += 1;
                gate.lastFailure = {
                    kind: failure.kind,
                    reason: failure.reason,
                    at: new Date().toISOString(),
                };

                this.emit(
                    {
                        ...context,
                        outcome: failure.kind,
                        reason: failure.reason,
                        durationMs: Date.now() - startedAt,
                    },
                    attempts
                );

                // The request itself is wrong. Spilling to another key would
                // burn the whole waterfall and bury the real error, so stop.
                if (failure.kind === "fatal") {
                    throw error;
                }

                gate.overflowUntil = Date.now() + (failure.cooldownMs ?? this.cooldowns[failure.kind]);
            }
        }

        throw new AllKeysExhaustedError(this.label, attempts);
    }

    /**
     * Keys that are ready, in priority order, followed by the overflowing ones
     * as a last resort. The tail matters: if every key is cooling down we still
     * make a real attempt rather than failing without touching the network.
     * Each key appears exactly once, so a single `run` never retries a key.
     */
    private attemptOrder(): Array<{ gate: Gate; lastResort: boolean }> {
        const now = Date.now();
        const ready: Array<{ gate: Gate; lastResort: boolean }> = [];
        const overflowing: Array<{ gate: Gate; lastResort: boolean }> = [];

        for (const gate of this.gates) {
            if (gate.overflowUntil <= now) {
                ready.push({ gate, lastResort: false });
            } else {
                overflowing.push({ gate, lastResort: true });
            }
        }

        return [...ready, ...overflowing];
    }

    private emit(event: AttemptEvent, sink: AttemptEvent[]): void {
        sink.push(event);
        this.onAttempt(event);
    }

    /** Snapshot of the dam, for health checks and debugging. Contains no keys. */
    status(): { label: string; total: number; ready: number; gates: GateStatus[] } {
        const now = Date.now();
        const gates = this.gates.map<GateStatus>((gate) => ({
            position: gate.position,
            key: gate.masked,
            state: gate.overflowUntil > now ? "overflowing" : "ready",
            overflowingForMs: Math.max(0, gate.overflowUntil - now),
            successes: gate.successes,
            failures: gate.failures,
            lastFailure: gate.lastFailure,
        }));

        return {
            label: this.label,
            total: gates.length,
            ready: gates.filter((gate) => gate.state === "ready").length,
            gates,
        };
    }

    /** Closes every gate immediately. Intended for tests and manual recovery. */
    reset(): void {
        for (const gate of this.gates) {
            gate.overflowUntil = 0;
        }
    }
}

function defaultAttemptLogger(label: string) {
    return (event: AttemptEvent): void => {
        if (event.outcome === "success") {
            // Successes are the hot path; keep them quiet unless a spill happened.
            if (event.position > 1 || event.lastResort) {
                console.info(
                    `[${label}] served by ${event.label}${event.lastResort ? " (last resort)" : ""} in ${event.durationMs}ms`
                );
            }
            return;
        }

        console.warn(
            `[${label}] ${event.label} failed: ${event.outcome} — ${event.reason} (${event.durationMs}ms)`
        );
    };
}
