import { eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import { hotelCache } from "../../db/schema.js";
import { env } from "../../config/env.js";
import {
    KeyWaterfall,
    type FailureKind,
    type KeyFailure,
} from "../../services/ai/keyWaterfall.js";

const SERP_API_URL = "https://serpapi.com/search";
const UPSTREAM_TIMEOUT_MS = 15_000;

// Hotel inventory and nightly rates for a future date window barely move
// day-to-day, and SerpApi's free tier is metered per search — a day of reuse
// keeps itinerary generation off the meter entirely for popular destinations.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Returned to callers and persisted into itineraries. Deliberately much smaller
// than SerpApi's property object: one image, the review numbers and the booking
// link are what the UI and the PDF actually render.
export type Hotel = {
    name: string;
    type: "hotel" | "vacation_rental";
    description: string;
    location: string;
    pricePerNight: number;
    totalPrice: number;
    currency: string;
    hotelClass: number | null;
    rating: number | null;
    reviewsCount: number | null;
    locationRating: number | null;
    amenities: string[];
    imageUrl: string | null;
    thumbnailUrl: string | null;
    bookingLink: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    coordinates: { lat: number; lon: number } | null;
    reviewHighlights: string[];
};

export type HotelQuery = {
    destination: string;
    checkIn: string;
    checkOut: string;
    adults: number;
};

type HttpError = Error & { statusCode: number };

function httpError(statusCode: number, message: string): HttpError {
    return Object.assign(new Error(message), { statusCode });
}

function cacheKeyFor(query: HotelQuery): string {
    return [
        query.destination.trim().toLowerCase().replace(/\s+/g, " "),
        query.checkIn,
        query.checkOut,
        query.adults,
    ].join("|");
}

function firstNumber(...values: unknown[]): number {
    for (const value of values) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
}

/**
 * SerpApi's `reviews_breakdown` is per-topic sentiment ("Rooms", "Location",
 * ...) with positive/negative/neutral counts. The topics people liked are the
 * useful part for a traveler skimming options, so we keep the names of the
 * topics that skew positive rather than the raw counts.
 */
function reviewHighlights(property: any): string[] {
    const breakdown = Array.isArray(property?.reviews_breakdown)
        ? property.reviews_breakdown
        : [];

    return breakdown
        .filter((topic: any) => Number(topic?.positive ?? 0) > Number(topic?.negative ?? 0))
        .slice(0, 5)
        .map((topic: any) => String(topic?.name ?? "").trim())
        .filter(Boolean);
}

export function normalizeProperty(property: any, destination: string, nights: number): Hotel | null {
    const name = String(property?.name ?? "").trim();
    if (!name) return null;

    const perNight = firstNumber(
        property?.rate_per_night?.extracted_lowest,
        property?.prices?.[0]?.rate_per_night?.extracted_lowest,
        // Some vacation rentals quote only a window total.
        nights > 0 ? firstNumber(property?.total_rate?.extracted_lowest) / nights : 0,
    );

    const total = firstNumber(property?.total_rate?.extracted_lowest) || perNight * Math.max(1, nights);

    const image = Array.isArray(property?.images) ? property.images[0] : null;

    // Google's nearby_places is the only location signal in the list response;
    // the first entry is the closest landmark, which reads better than nothing.
    const nearby = Array.isArray(property?.nearby_places)
        ? String(property.nearby_places.find((place: any) => place?.name)?.name ?? "").trim()
        : "";

    return {
        name,
        type: property?.type === "vacation rental" ? "vacation_rental" : "hotel",
        description: String(property?.description ?? "").trim(),
        location: nearby ? `Near ${nearby}, ${destination}` : destination,
        pricePerNight: Math.round(perNight),
        totalPrice: Math.round(total),
        currency: "INR",
        hotelClass: Number.isFinite(Number(property?.extracted_hotel_class))
            ? Number(property.extracted_hotel_class)
            : null,
        rating: Number.isFinite(Number(property?.overall_rating))
            ? Number(property.overall_rating)
            : null,
        reviewsCount: Number.isFinite(Number(property?.reviews)) ? Number(property.reviews) : null,
        locationRating: Number.isFinite(Number(property?.location_rating))
            ? Number(property.location_rating)
            : null,
        amenities: Array.isArray(property?.amenities)
            ? property.amenities.slice(0, 10).map(String)
            : [],
        // original_image is a full-size photo straight from the booking site and
        // can be a megabyte; the thumbnail is what cards and the PDF want. Both
        // are kept so a detail view can upgrade without another search.
        imageUrl: image?.original_image ? String(image.original_image) : null,
        thumbnailUrl: image?.thumbnail ? String(image.thumbnail) : null,
        bookingLink: property?.link ? String(property.link) : null,
        checkInTime: property?.check_in_time ? String(property.check_in_time) : null,
        checkOutTime: property?.check_out_time ? String(property.check_out_time) : null,
        coordinates:
            Number.isFinite(Number(property?.gps_coordinates?.latitude)) &&
            Number.isFinite(Number(property?.gps_coordinates?.longitude))
                ? {
                      lat: Number(property.gps_coordinates.latitude),
                      lon: Number(property.gps_coordinates.longitude),
                  }
                : null,
        reviewHighlights: reviewHighlights(property),
    };
}

function nightsBetween(checkIn: string, checkOut: string): number {
    const start = new Date(`${checkIn}T00:00:00`).getTime();
    const end = new Date(`${checkOut}T00:00:00`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
    return Math.max(1, Math.round((end - start) / 86_400_000));
}

/**
 * A SerpApi failure, pre-classified for the key waterfall. Thrown by
 * `fetchOnce` so the waterfall knows whether another key could fix it.
 */
export class SerpFailure extends Error {
    constructor(
        readonly kind: FailureKind,
        readonly reason: string,
        readonly cooldownMs?: number,
    ) {
        super(reason);
        this.name = "SerpFailure";
    }
}

export function classifySerpFailure(error: unknown): KeyFailure {
    if (error instanceof SerpFailure) {
        return {
            kind: error.kind,
            reason: error.reason,
            ...(error.cooldownMs !== undefined ? { cooldownMs: error.cooldownMs } : {}),
        };
    }
    // Anything unclassified is treated as the upstream's fault, not the key's.
    return { kind: "transient", reason: error instanceof Error ? error.message : "unknown error" };
}

let serpWaterfall: KeyWaterfall | null = null;

/**
 * Built lazily: `new KeyWaterfall` throws when handed zero keys, and SerpApi is
 * optional — the app must still boot and answer 503 here without a key.
 */
function getSerpWaterfall(): KeyWaterfall {
    if (!serpWaterfall) {
        serpWaterfall = new KeyWaterfall({
            label: "serpapi",
            keys: env.SERP_API_KEYS,
            classify: classifySerpFailure,
        });
    }
    return serpWaterfall;
}

/** Masked per-key state, for the health endpoint. Contains no keys. */
export function serpStatus(): Record<string, unknown> {
    return env.SERP_API_KEYS.length > 0
        ? getSerpWaterfall().status()
        : { label: "serpapi", total: 0, ready: 0, gates: [] };
}

/**
 * Classifies SerpApi's 200-with-`error` body.
 *
 * SerpApi echoes request parameters into some of these strings, and `q` is
 * attacker-controlled free text (2-150 chars, any authenticated user). If a
 * body string could fault a key, someone could search for "run out of
 * searches" and park every key in the waterfall, taking hotel search down for
 * everyone. Two rules keep that shut:
 *
 * 1. A body string can never mark a key `invalid`. That is the 30-minute park,
 *    the most damaging state, and HTTP 401/403 already covers a rejected key
 *    structurally — no free text needed.
 * 2. The `exhausted` match is skipped when the message quotes our own query
 *    back at us, because then the text is the user's, not SerpApi's.
 *
 * Anything else is `fatal`: our request is wrong, and no other key fixes it.
 */
export function classifySerpBody(message: string, destination: string): SerpFailure {
    const echoesQuery =
        destination.length >= 2 && message.toLowerCase().includes(destination.toLowerCase());

    if (!echoesQuery && /(run out of|exceeded your) searches/i.test(message)) {
        return new SerpFailure("exhausted", "plan out of searches");
    }

    // Truncated: this reaches logs and the error middleware, and the text may
    // be the caller's own input reflected back.
    return new SerpFailure("fatal", `serpapi: ${message.slice(0, 200)}`);
}

/** One SerpApi search with one key. Failures are classified, never swallowed. */
async function fetchOnce(query: HotelQuery, apiKey: string): Promise<Hotel[]> {
    const url = new URL(SERP_API_URL);
    url.searchParams.set("engine", "google_hotels");
    url.searchParams.set("q", query.destination);
    url.searchParams.set("check_in_date", query.checkIn);
    url.searchParams.set("check_out_date", query.checkOut);
    url.searchParams.set("adults", String(query.adults));
    url.searchParams.set("currency", "INR");
    url.searchParams.set("gl", "in");
    url.searchParams.set("hl", "en");
    url.searchParams.set("api_key", apiKey);

    let response: Response;
    try {
        response = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    } catch (error) {
        const timedOut = error instanceof Error && error.name === "TimeoutError";
        throw new SerpFailure("transient", timedOut ? "request timed out" : "network error");
    }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new SerpFailure("invalid", `key rejected (${response.status})`);
        }
        if (response.status === 429) {
            // Honour Retry-After when SerpApi sends one, so the gate reopens
            // exactly when the window does instead of on our generic cooldown.
            const retryAfter = Number(response.headers.get("retry-after"));
            throw new SerpFailure(
                "exhausted",
                "rate limit reached",
                Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
            );
        }
        if (response.status >= 500) {
            throw new SerpFailure("transient", `upstream ${response.status}`);
        }
        // A 4xx that is not key-shaped means our query is wrong; no other key
        // fixes that, so stop the waterfall rather than burning every key.
        throw new SerpFailure("fatal", `bad request (${response.status})`);
    }

    const body = (await response.json()) as any;

    // SerpApi answers 200 with an `error` string for an exhausted plan or an
    // unsupported query, so a non-ok status is not the only failure mode.
    if (body?.error) {
        throw classifySerpBody(String(body.error), query.destination);
    }

    const nights = nightsBetween(query.checkIn, query.checkOut);

    return (Array.isArray(body?.properties) ? body.properties : [])
        .map((property: any) => normalizeProperty(property, query.destination, nights))
        .filter((hotel: Hotel | null): hotel is Hotel => hotel !== null && hotel.pricePerNight > 0);
}

/**
 * SerpApi search across every configured key, highest priority first. Mirrors
 * the Gemini key waterfall: a key that is out of searches or rejected spills
 * down to the next one and is skipped for a cooldown, so an exhausted key does
 * not cost every later request a wasted round-trip.
 */
async function fetchFromSerpApi(query: HotelQuery): Promise<Hotel[]> {
    if (env.SERP_API_KEYS.length === 0) {
        throw httpError(503, "Hotel search is not configured.");
    }

    return getSerpWaterfall().run((apiKey) => fetchOnce(query, apiKey));
}

/**
 * Normalized hotels for a destination/date window, served from the
 * `hotel_cache` table when the row is younger than CACHE_TTL_MS.
 *
 * A stale row is kept rather than deleted: if SerpApi is down or out of quota,
 * yesterday's hotel list is far better than an error, so an upstream failure
 * falls back to it.
 */
export async function getHotels(query: HotelQuery): Promise<{ hotels: Hotel[]; cached: boolean }> {
    const cacheKey = cacheKeyFor(query);

    const [existing] = await db
        .select()
        .from(hotelCache)
        .where(eq(hotelCache.cacheKey, cacheKey))
        .limit(1);

    if (existing && Date.now() - new Date(existing.fetchedAt).getTime() < CACHE_TTL_MS) {
        return { hotels: existing.results as Hotel[], cached: true };
    }

    let hotels: Hotel[];
    try {
        hotels = await fetchFromSerpApi(query);
    } catch (error) {
        if (existing) {
            console.warn(
                "[HOTELS] Upstream failed, serving stale cache:",
                error instanceof Error ? error.message : error,
            );
            return { hotels: existing.results as Hotel[], cached: true };
        }
        throw error;
    }

    await db
        .insert(hotelCache)
        .values({
            cacheKey,
            destination: query.destination.slice(0, 150),
            checkIn: query.checkIn,
            checkOut: query.checkOut,
            adults: query.adults,
            results: hotels,
        })
        .onConflictDoUpdate({
            target: hotelCache.cacheKey,
            set: { results: hotels, fetchedAt: new Date() },
        });

    return { hotels, cached: false };
}

/**
 * Best-effort variant for itinerary generation: a hotel lookup must never be
 * the reason a trip fails to generate, so every failure degrades to an empty
 * list and the AI's own accommodation suggestions are used instead.
 */
export async function getHotelsOrEmpty(query: HotelQuery): Promise<Hotel[]> {
    try {
        const { hotels } = await getHotels(query);
        return hotels;
    } catch (error) {
        console.warn(
            "[HOTELS] Lookup failed, continuing without real hotels:",
            error instanceof Error ? error.message : error,
        );
        return [];
    }
}
