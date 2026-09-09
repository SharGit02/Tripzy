import { env } from "../../config/env.js";

const OPEN_WEATHER_BASE = "https://api.openweathermap.org/data/2.5";
const UPSTREAM_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 10 * 60 * 1000;

// OpenWeather's free tier is rate limited per key, and a dashboard widget can
// easily fan out to many requests for the same handful of cities. A short-lived
// in-process cache keeps us well inside the quota; weather that is up to ten
// minutes stale is indistinguishable to the user.
const cache = new Map<string, { expiresAt: number; payload: WeatherPayload }>();

type HttpError = Error & { statusCode: number };

function httpError(statusCode: number, message: string): HttpError {
    return Object.assign(new Error(message), { statusCode });
}

type OpenWeatherCondition = {
    id: number;
    main: string;
    description: string;
    icon: string;
};

type CurrentWeatherResponse = {
    dt: number;
    timezone: number;
    name: string;
    coord: { lat: number; lon: number };
    sys: { country?: string };
    main: {
        temp: number;
        feels_like: number;
        temp_min: number;
        temp_max: number;
        humidity: number;
        pressure: number;
    };
    wind: { speed: number; deg?: number };
    clouds?: { all?: number };
    visibility?: number;
    weather: OpenWeatherCondition[];
};

type ForecastEntry = {
    dt: number;
    main: { temp: number; temp_min: number; temp_max: number; humidity: number };
    wind: { speed: number };
    pop?: number;
    weather: OpenWeatherCondition[];
};

type ForecastResponse = {
    list: ForecastEntry[];
    city: { name: string; country?: string; timezone: number };
};

export type WeatherDay = {
    date: string;
    day: string;
    highC: number;
    lowC: number;
    icon: string;
    condition: string;
    precipitationChance: number;
};

export type WeatherPayload = {
    location: {
        city: string;
        country: string | null;
        label: string;
        lat: number;
        lon: number;
        timezoneOffsetSeconds: number;
    };
    current: {
        observedAt: string;
        localDate: string;
        tempC: number;
        feelsLikeC: number;
        highC: number;
        lowC: number;
        condition: string;
        icon: string;
        humidity: number;
        windKph: number;
        precipitationChance: number;
        cloudCover: number;
        pressureHpa: number;
        visibilityKm: number | null;
    };
    forecast: WeatherDay[];
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// OpenWeather timestamps are UTC epochs and every response carries the city's
// UTC offset separately. Shifting the epoch by that offset and then reading it
// with the UTC getters yields the city's own local clock, independent of
// whatever timezone the server happens to run in.
function toCityLocalDate(epochSeconds: number, offsetSeconds: number): Date {
    return new Date((epochSeconds + offsetSeconds) * 1000);
}

function localDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function formatLocalDate(date: Date): string {
    return `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function round(value: number, decimals = 0): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function titleCase(value: string): string {
    return value
        .split(" ")
        .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
        .join(" ");
}

async function fetchOpenWeather<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!env.OPEN_WEATHER_API) {
        throw httpError(503, "Weather service is not configured.");
    }

    const url = new URL(`${OPEN_WEATHER_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    url.searchParams.set("units", "metric");
    url.searchParams.set("appid", env.OPEN_WEATHER_API);

    let response: Response;
    try {
        response = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    } catch {
        throw httpError(504, "Weather service did not respond in time.");
    }

    if (response.ok) {
        return (await response.json()) as T;
    }

    if (response.status === 404) {
        throw httpError(404, "We couldn't find weather for that city.");
    }
    if (response.status === 401 || response.status === 403) {
        // A bad or unactivated API key is our misconfiguration, never the
        // caller's — so it stays a 5xx. The message is deliberately distinct
        // from the missing-key case above: a freshly issued OpenWeather key is
        // rejected for up to a couple of hours before it activates, and that is
        // impossible to diagnose if both failures read the same in the logs.
        throw httpError(503, "Weather service credentials were rejected by OpenWeather.");
    }
    if (response.status === 429) {
        throw httpError(429, "Weather service is busy. Please try again shortly.");
    }
    throw httpError(502, "Weather service is temporarily unavailable.");
}

type DailyBucket = {
    date: string;
    day: string;
    min: number;
    max: number;
    pop: number;
    // The entry nearest local noon is the most representative summary of a day,
    // rather than whichever 3-hour slot happens to come first.
    middayDistanceHours: number;
    icon: string;
    condition: string;
};

function buildDailyBuckets(forecast: ForecastResponse, offsetSeconds: number): Map<string, DailyBucket> {
    const buckets = new Map<string, DailyBucket>();

    for (const entry of forecast.list) {
        const local = toCityLocalDate(entry.dt, offsetSeconds);
        const key = localDateKey(local);
        const condition = entry.weather[0];
        const middayDistance = Math.abs(local.getUTCHours() + local.getUTCMinutes() / 60 - 12);

        const existing = buckets.get(key);
        if (!existing) {
            buckets.set(key, {
                date: key,
                day: DAY_NAMES[local.getUTCDay()]!,
                min: entry.main.temp_min,
                max: entry.main.temp_max,
                pop: entry.pop ?? 0,
                middayDistanceHours: middayDistance,
                // Force the daytime icon variant: a forecast row reads as a row
                // of days, so a night icon on one of them looks like a glitch.
                icon: (condition?.icon ?? "01d").replace(/n$/, "d"),
                condition: titleCase(condition?.description ?? "Unknown"),
            });
            continue;
        }

        existing.min = Math.min(existing.min, entry.main.temp_min);
        existing.max = Math.max(existing.max, entry.main.temp_max);
        existing.pop = Math.max(existing.pop, entry.pop ?? 0);

        if (middayDistance < existing.middayDistanceHours) {
            existing.middayDistanceHours = middayDistance;
            existing.icon = (condition?.icon ?? existing.icon).replace(/n$/, "d");
            existing.condition = titleCase(condition?.description ?? existing.condition);
        }
    }

    return buckets;
}

function normalize(current: CurrentWeatherResponse, forecast: ForecastResponse): WeatherPayload {
    const offsetSeconds = current.timezone ?? forecast.city.timezone ?? 0;
    const nowLocal = toCityLocalDate(current.dt, offsetSeconds);
    const todayKey = localDateKey(nowLocal);

    const buckets = buildDailyBuckets(forecast, offsetSeconds);
    const today = buckets.get(todayKey);

    // The forecast only covers the remainder of today, so the observed
    // temperature has to be folded in or a hot morning vanishes from the high.
    const highC = round(Math.max(current.main.temp, current.main.temp_max, today?.max ?? -Infinity));
    const lowC = round(Math.min(current.main.temp, current.main.temp_min, today?.min ?? Infinity));

    const days = [...buckets.values()]
        .sort((a, b) => a.date.localeCompare(b.date))
        .filter((bucket) => bucket.date >= todayKey)
        .slice(0, 5)
        .map<WeatherDay>((bucket) => ({
            date: bucket.date,
            day: bucket.day,
            highC: round(bucket.date === todayKey ? Math.max(bucket.max, current.main.temp) : bucket.max),
            lowC: round(bucket.date === todayKey ? Math.min(bucket.min, current.main.temp) : bucket.min),
            icon: bucket.icon,
            condition: bucket.condition,
            precipitationChance: Math.round(bucket.pop * 100),
        }));

    const condition = current.weather[0];
    const cityName = current.name || forecast.city.name;
    const countryCode = current.sys?.country ?? forecast.city.country ?? null;

    return {
        location: {
            city: cityName,
            country: countryCode,
            label: [cityName, countryCode].filter(Boolean).join(", "),
            lat: current.coord.lat,
            lon: current.coord.lon,
            timezoneOffsetSeconds: offsetSeconds,
        },
        current: {
            observedAt: new Date(current.dt * 1000).toISOString(),
            localDate: formatLocalDate(nowLocal),
            tempC: round(current.main.temp),
            feelsLikeC: round(current.main.feels_like),
            highC,
            lowC,
            condition: titleCase(condition?.description ?? "Unknown"),
            icon: condition?.icon ?? "01d",
            humidity: Math.round(current.main.humidity),
            // OpenWeather reports metric wind in m/s; the widget shows km/h.
            windKph: round(current.wind.speed * 3.6),
            precipitationChance: Math.round((today?.pop ?? 0) * 100),
            cloudCover: Math.round(current.clouds?.all ?? 0),
            pressureHpa: Math.round(current.main.pressure),
            visibilityKm: typeof current.visibility === "number" ? round(current.visibility / 1000, 1) : null,
        },
        forecast: days,
    };
}

export async function getWeatherForCity(city: string): Promise<WeatherPayload> {
    const cacheKey = city.trim().toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.payload;
    }

    const [current, forecast] = await Promise.all([
        fetchOpenWeather<CurrentWeatherResponse>("/weather", { q: city }),
        fetchOpenWeather<ForecastResponse>("/forecast", { q: city }),
    ]);

    const payload = normalize(current, forecast);
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    return payload;
}
