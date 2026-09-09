import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

const serverRoot = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(serverRoot, "../.env") });
dotenv.config({ path: path.join(serverRoot, ".env"), override: true });

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL || process.env.NEON_URI!,
    },
    strict: true,
    verbose: true,
});