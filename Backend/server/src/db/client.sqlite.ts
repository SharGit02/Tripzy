import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import Database from "better-sqlite3";
import * as schema from "./schema.sqlite.js";

const sqlite = new Database("tripzy.db");
export const db = drizzle(sqlite, { schema });

export async function connectDatabase(): Promise<void> {
    // SQLite connects synchronously, just verify it works
    sqlite.exec("select 1");
    console.log("Connected to SQLite database (tripzy.db)");
}

export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
        sqlite.exec("select 1");
        return { ok: true, latencyMs: Date.now() - start };
    } catch (error) {
        return {
            ok: false,
            latencyMs: Date.now() - start,
            error: error instanceof Error ? error.message : "Unknown database error",
        };
    }
}