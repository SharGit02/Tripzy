import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

import { env } from "../config/env.js";
import * as schema from "./schema.js";

export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 5,
    min: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    // Verify the server certificate. Set explicitly rather than left to the
    // URL's sslmode: DATABASE_URL carries `uselibpqcompat=true&sslmode=require`,
    // which under libpq semantics means "encrypt but do not verify" — an
    // encrypted connection to whoever answers, which a MITM on the path can
    // satisfy. Neon's certs chain to Let's Encrypt, so this needs no custom CA;
    // a provider with a private CA would pass `ca: env.DATABASE_CA_CERT` here.
    ssl: { rejectUnauthorized: true },
    // Neon serverless instances hibernate after inactivity.
    // Keeping the pool small and sending a keepalive every 30s prevents
    // stale connection errors after idle periods.
    keepAlive: true,
    keepAliveInitialDelayMillis: 30_000,
});

pool.on("error", (error) => {
    console.error("Unexpected error on idle Postgres client", error);
});

// Send a lightweight keepalive ping every 45 s so Neon's serverless
// compute doesn't hibernate mid-session and drop our idle connections.
if (process.env.NODE_ENV !== 'test') {
    setInterval(() => {
        pool.query('SELECT 1').catch((err) =>
            console.warn('[DB] Keepalive ping failed:', err.message)
        );
    }, 45_000);
}

export const db = drizzle(pool, { schema });

// drizzle wraps driver failures in DrizzleQueryError ("Failed query: ...") and
// keeps the real pg error (ENOTFOUND, auth, cert, timeout) on .cause.
function describeError(error: unknown): string {
    if (!(error instanceof Error)) return "Unknown database error";
    const parts = [error.message];
    for (let cause = error.cause; cause instanceof Error; cause = cause.cause) {
        const code = (cause as { code?: string }).code;
        parts.push(code ? `${code}: ${cause.message}` : cause.message);
    }
    return parts.join(" <- ");
}

export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
        await db.execute(sql`select 1`);
        return { ok: true, latencyMs: Date.now() - start };
    } catch (error) {
        return {
            ok: false,
            latencyMs: Date.now() - start,
            error: describeError(error),
        };
    }
}

export async function connectDatabase(): Promise<void> {
    const result = await pingDatabase();
    if (!result.ok) {
        throw new Error(`Unable to connect to Postgres: ${result.error}`);
    }
    console.log(`### Connected to Postgres successfully. Latency: ${result.latencyMs}ms`);
}
