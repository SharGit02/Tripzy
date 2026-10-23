/**
 * Postgres TLS configuration.
 *
 * `pg` merges a parsed connectionString OVER the explicit config object
 * (ConnectionParameters: `Object.assign({}, config, parse(connectionString))`),
 * so `ssl: { rejectUnauthorized: true }` next to a connectionString carrying
 * `sslmode=require` is silently discarded — the URL wins. Our DATABASE_URL has
 * `uselibpqcompat=true&sslmode=require`, which pg-connection-string turns into
 * `{ rejectUnauthorized: false }`: encrypted to whoever answers, verified
 * against nothing.
 *
 * So the ssl parameters are stripped from the URL first, leaving the explicit
 * object as the only source of TLS policy. Doing it in code rather than by
 * setting `sslmode=verify-full` in the URL keeps verification from depending on
 * env-var hygiene across local .env files and every Render service.
 */

// Everything pg-connection-string reads to build its `ssl` object.
const SSL_URL_PARAMS = [
    "sslmode",
    "uselibpqcompat",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "ssl",
];

/** Strips TLS parameters from a Postgres URL so explicit `ssl` config survives. */
export function stripUrlSslParams(url: string): string {
    const parsed = new URL(url);
    for (const param of SSL_URL_PARAMS) parsed.searchParams.delete(param);
    return parsed.toString();
}

/**
 * Pool TLS options. Neon's certificates chain to Let's Encrypt and pass
 * hostname verification, so no CA override is needed; a provider with a
 * private CA would need `ca` added here.
 */
export const poolSsl = { rejectUnauthorized: true } as const;

/** Throws if a URL would still override the explicit ssl config. */
export function assertNoUrlSslParams(url: string): void {
    const parsed = new URL(url);
    const leftover = SSL_URL_PARAMS.filter((p) => parsed.searchParams.has(p));
    if (leftover.length > 0) {
        throw new Error(
            `Postgres URL still carries TLS parameters (${leftover.join(", ")}), ` +
            "which pg would merge over the explicit ssl config and disable verification."
        );
    }
}
