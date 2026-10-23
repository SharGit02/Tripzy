import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Scoped tightly to credential-guessing endpoints (login/signup) — brute-force /
// credential-stuffing protection. Keyed by IP by default.
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    // 10, not 100: this is the credential-guessing budget for a single IP over
    // 15 minutes. It was temporarily raised to 100 for testing and that is far
    // too generous for a password endpoint — 100 tries per quarter hour is
    // ~9,600/day against every account. Ten is plenty for a human who forgot
    // which password they used.
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." },
});

/*
 * Itinerary generation is by far the most expensive thing this API does: one
 * call spends a Gemini generation (metered, with a key waterfall behind it),
 * one SerpApi hotel search on a cache miss (free tier, metered per search),
 * and a Postgres write. Being behind authMiddleware is not a budget — one
 * signed-in account could otherwise exhaust the whole month's third-party
 * quota in a few minutes, which is a billing incident, not just a slow API.
 *
 * Keyed per user rather than per IP: the cost follows the account, and
 * several people behind one NAT should not share a generation budget.
 */
export const itineraryGenerateRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
    // The IP fallback is normalized through ipKeyGenerator: a raw req.ip lets
    // an IPv6 client hop addresses inside its own /64 and get a fresh budget
    // per request.
    keyGenerator: (req, res) => req.user?.userId || ipKeyGenerator(req.ip ?? "", 56) || "anonymous",
    message: {
        message: "You've generated a lot of trips in the past hour. Please try again later.",
    },
});

// PDF rendering is CPU-bound and synchronous (PDFKit builds the whole document
// in-process), so a loop over it starves every other request on a single
// free-tier instance. Emailing one also spends Resend quota on top.
export const itineraryExportRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => req.user?.userId || ipKeyGenerator(req.ip ?? "", 56) || "anonymous",
    message: { message: "Too many exports. Please try again shortly." },
});

// The public share endpoint is unauthenticated, so it has no per-user budget
// to fall back on. UUIDv4 ids are not practically enumerable, but an open
// endpoint that reads the database on every hit still wants a ceiling.
export const publicItineraryRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again shortly." },
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

// The hotels endpoint proxies SerpApi's Google Hotels engine, which is metered
// per search on a free-tier plan shared by every user. Results are cached in
// Postgres for 24 hours per destination/date window, so normal use almost never
// reaches upstream — the limit exists to stop a single client burning the
// month's quota by walking dates.
export const hotelsRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many hotel searches. Please try again shortly." },
});
