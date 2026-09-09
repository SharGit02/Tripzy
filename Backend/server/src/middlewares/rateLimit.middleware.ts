import rateLimit from "express-rate-limit";

// Scoped tightly to credential-guessing endpoints (login/signup) — brute-force /
// credential-stuffing protection. Keyed by IP by default.
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100, // Increased from 10 to 100 for testing
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." },
});

// Refresh requires a valid signed refresh-token cookie already, so it isn't a
// credential-guessing surface — but the frontend calls it automatically on any
// 401, so it needs a much higher budget than login/signup or normal usage
// (multiple tabs, bursts of requests after an idle period) could trip it and
// lock a legitimate session out of both refresh and login at once.
export const refreshRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many refresh attempts. Please sign in again." },
});

// The weather endpoint proxies a metered third-party API on a shared key, so
// the limit protects our OpenWeather quota rather than an auth surface. The
// budget is generous because responses are cached server-side for 10 minutes —
// normal browsing rarely reaches upstream at all.
export const weatherRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many weather lookups. Please try again shortly." },
});

// The flight-fare endpoint proxies a compute-heavy scan (up to 30 candidate
// days, each running several Hist_* lookups plus a LightGBM predict per
// matching flight on that weekday) against an uncached, uncachable-by-design
// per-route/date query. The budget is far tighter than weather's cached
// 120/15min: 20/15min comfortably covers a person manually trying a few
// routes/dates, while making scripted abuse of the ML process expensive fast.
export const flightFareRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many fare prediction requests. Please try again shortly." },
});
