import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(configDir, "../..");
const backendRoot = path.resolve(serverRoot, "..");

dotenv.config({ path: path.join(backendRoot, ".env") });
dotenv.config({ path: path.join(serverRoot, ".env"), override: true });

const envSchema = z
    .object({
        NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
        PORT: z.coerce.number().default(5000),

        // Comma-separated list of allowed origins, e.g.
        // "http://localhost:5173,https://tripzee.vercel.app"
        CORS_ORIGINS: z.string().min(1).default("http://localhost:5173"),

        // Neon/Postgres connection string. Accept either name so the existing
        // NEON_URI in .env keeps working without renaming it.
        DATABASE_URL: z.string().min(1).optional(),
        NEON_URI: z.string().min(1).optional(),

        JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),

        // OpenWeather API key. Optional so the rest of the app still boots
        // without it; the weather endpoint answers 503 when it is missing.
        OPEN_WEATHER_API: z.string().min(1).optional(),

        // Flight fare ML microservice (FastAPI, ml-microservice/). Both
        // optional, matching OPEN_WEATHER_API's degrade-gracefully pattern —
        // the flight-fare endpoint answers 503 when the key is missing rather
        // than blocking boot. Base URL defaults to localhost in the service
        // file itself, not here, since that default is only meaningful at
        // the point it's consumed.
        FASTAPI_ML_BASE_URL: z.string().trim().min(1).optional(),
        FASTAPI_ML_API_KEY: z.string().trim().min(1).optional(),

        // Gemini generation settings. The keys themselves are not declared here
        // because there is an arbitrary number of them — see collectNumberedKeys.
        GEMINI_MODEL: z.string().trim().min(1).default("gemini-3.5-flash"),
        // Comma-separated fallback models tried in order when primary fails.
        // Example: "gemini-3.6-flash,gemini-flash-latest,gemini-2.5-flash"
        GEMINI_MODEL_FALLBACKS: z.string().trim().optional(),
        // 60s, not 30s: Gemini 3.x models spend hidden "thinking" tokens before
        // emitting text, and structured-output calls were observed exceeding 30s.
        GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),

        // OAuth configuration (Google & GitHub)
        GOOGLE_CLIENT_ID: z.string().trim().optional(),
        GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
        GOOGLE_CALLBACK_URL: z.string().trim().optional(),

        GITHUB_CLIENT_ID: z.string().trim().optional(),
        GITHUB_CLIENT_SECRET: z.string().trim().optional(),
        GITHUB_CALLBACK_URL: z.string().trim().optional(),

        FRONTEND_URL: z.string().trim().optional(),
    })
    .refine((data) => Boolean(data.DATABASE_URL || data.NEON_URI), {
        message: "DATABASE_URL or NEON_URI is required",
        path: ["DATABASE_URL"],
    });

/**
 * Collects `PREFIX_1`, `PREFIX_2`, ... into a priority-ordered list, and also
 * accepts a bare `PREFIX` as the highest priority entry.
 *
 * Discovering these at runtime rather than declaring each one in the schema is
 * what makes the key waterfall scalable: adding a sixth Gemini key is a one-line
 * .env change with no code edit anywhere.
 *
 * Sorting is numeric, not lexicographic, so `_10` follows `_9` instead of `_1`.
 * Duplicates are dropped — the same key twice is not redundancy, it is one key
 * occupying two gates and failing over to itself.
 */
function collectNumberedKeys(prefix: string): string[] {
    const numbered = Object.keys(process.env)
        .map((name) => {
            if (name === prefix) return { name, order: 0 };
            const match = name.match(new RegExp(`^${prefix}_(\\d+)$`));
            return match ? { name, order: Number(match[1]) } : null;
        })
        .filter((entry): entry is { name: string; order: number } => entry !== null)
        .sort((a, b) => a.order - b.order);

    const seen = new Set<string>();
    const keys: string[] = [];

    for (const { name } of numbered) {
        const value = process.env[name]?.trim();
        if (!value || seen.has(value)) continue;
        seen.add(value);
        keys.push(value);
    }

    return keys;
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}

const data = parsed.data;

export const env = {
    ...data,
    DATABASE_URL: (data.DATABASE_URL || data.NEON_URI) as string,
    // Trailing slashes are stripped because browsers never send one in the
    // Origin header (it's scheme+host+port only) — a trailing slash left in
    // here would silently fail to match and block a legitimate origin.
    CORS_ORIGIN_LIST: data.CORS_ORIGINS.split(",")
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean),

    // Gemini keys in waterfall priority order: index 0 is tried first.
    GEMINI_API_KEYS: collectNumberedKeys("GEMINI_API_KEY"),
    // Model fallback chain (comma-separated, tried in order).
    GEMINI_MODEL_FALLBACKS: data.GEMINI_MODEL_FALLBACKS,
};
