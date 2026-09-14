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
    ssl: { rejectUnauthorized: false },
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

export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
        await db.execute(sql`select 1`);
        return { ok: true, latencyMs: Date.now() - start };
    } catch (error) {
        return {
            ok: false,
            latencyMs: Date.now() - start,
            error: error instanceof Error ? error.message : "Unknown database error",
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
