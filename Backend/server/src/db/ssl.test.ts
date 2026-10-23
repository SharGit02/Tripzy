import { describe, it, expect } from "vitest";
// Reaching into pg internals on purpose: this asserts what pg ACTUALLY does
// with our config, which is the part that was wrong before — an explicit
// `ssl: { rejectUnauthorized: true }` was silently discarded by the URL.
// @ts-expect-error — @types/pg ships types for this internal module but its
// package.json "exports" does not expose them under NodeNext resolution.
import ConnectionParameters from "pg/lib/connection-parameters.js";
import { stripUrlSslParams, assertNoUrlSslParams, poolSsl } from "./ssl.js";

const NEON_URL =
    "postgres://u:p@ep-x.ap-southeast-1.aws.neon.tech/db" +
    "?uselibpqcompat=true&sslmode=require&channel_binding=require";

const effectiveSsl = (url: string) =>
    new ConnectionParameters({ connectionString: url, ssl: poolSsl }).ssl;

describe("postgres TLS config", () => {
    it("rejects unverified TLS when the URL's ssl params are stripped", () => {
        expect(effectiveSsl(stripUrlSslParams(NEON_URL))).toEqual({ rejectUnauthorized: true });
    });

    it("documents the bug: an unstripped URL silently disables verification", () => {
        expect(effectiveSsl(NEON_URL)).toEqual({ rejectUnauthorized: false });
    });

    it("keeps non-ssl query params and the rest of the URL intact", () => {
        const stripped = new URL(stripUrlSslParams(NEON_URL));
        expect(stripped.searchParams.get("channel_binding")).toBe("require");
        expect(stripped.hostname).toBe("ep-x.ap-southeast-1.aws.neon.tech");
        expect(stripped.pathname).toBe("/db");
        expect(stripped.searchParams.has("sslmode")).toBe(false);
    });

    it("assertNoUrlSslParams guards against a URL that would override us", () => {
        expect(() => assertNoUrlSslParams(NEON_URL)).toThrow(/sslmode/);
        expect(() => assertNoUrlSslParams(stripUrlSslParams(NEON_URL))).not.toThrow();
    });
});
