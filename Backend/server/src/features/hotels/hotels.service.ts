import { eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import { hotelCache } from "../../db/schema.js";
import { env } from "../../config/env.js";

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

async function fetchFromSerpApi(query: HotelQuery): Promise<Hotel[]> {
    if (!env.SERP_API_KEY) {
        throw httpError(503, "Hotel search is not configured.");
    }

    const url = new URL(SERP_API_URL);
    url.searchParams.set("engine", "google_hotels");
    url.searchParams.set("q", query.destination);
    url.searchParams.set("check_in_date", query.checkIn);
    url.searchParams.set("check_out_date", query.checkOut);
    url.searchParams.set("adults", String(query.adults));
    url.searchParams.set("currency", "INR");
    url.searchParams.set("gl", "in");
    url.searchParams.set("hl", "en");
    url.searchParams.set("api_key", env.SERP_API_KEY);

    let response: Response;
    try {
        response = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    } catch {
        throw httpError(504, "Hotel search did not respond in time.");
    }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw httpError(503, "Hotel search credentials were rejected by SerpApi.");
        }
        if (response.status === 429) {
            throw httpError(429, "Hotel search quota reached. Please try again later.");
        }
        throw httpError(502, "Hotel search is temporarily unavailable.");
    }

    const body = (await response.json()) as any;

    // SerpApi answers 200 with an `error` string for an exhausted plan or an
    // unsupported query, so a non-ok status is not the only failure mode.
    if (body?.error) {
        throw httpError(502, `Hotel search failed: ${String(body.error)}`);
    }

    const nights = nightsBetween(query.checkIn, query.checkOut);

    return (Array.isArray(body?.properties) ? body.properties : [])
        .map((property: any) => normalizeProperty(property, query.destination, nights))
        .filter((hotel: Hotel | null): hotel is Hotel => hotel !== null && hotel.pricePerNight > 0);
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
