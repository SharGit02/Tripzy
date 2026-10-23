/**
 * Applies pending Drizzle migrations, then exits.
 *
 * Run from entrypoint.sh before the server starts. The container used to boot
 * straight into `node dist/index.js`, so a service pointed at an empty
 * database came up "healthy" — /api/health only runs `select 1`, which passes
 * without any tables — and then 500'd on the first real query. Migrating on
 * boot means a fresh database is usable, and a broken one fails loudly here
 * instead of silently serving errors.
 *
 * Uses drizzle-orm's migrator rather than `drizzle-kit migrate` on purpose:
 * drizzle-kit is a devDependency and the image runs `npm prune --omit=dev`,
 * so it does not exist at runtime. drizzle-orm does, and both read the same
 * drizzle/meta/_journal.json and __drizzle_migrations bookkeeping table.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { env } from "../config/env.js";

// dist/db/migrate.js -> /app/server/drizzle (same hop from src/ under tsx).
const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

// ponytail: no advisory lock around this. Fine at WEB_CONCURRENCY=1 on a
// single Render instance; if this ever scales to concurrent boots, wrap the
// migrate() call in `select pg_advisory_lock(...)` so two instances cannot
// apply the same migration at once.
const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 30_000,
    ssl: { rejectUnauthorized: false },
});

try {
    console.log(`### Applying migrations from ${migrationsFolder}`);
    await migrate(drizzle(pool), { migrationsFolder });
    console.log("### Migrations up to date.");
} catch (error) {
    console.error("### Migration failed:", error);
    process.exitCode = 1;
} finally {
    await pool.end();
}
