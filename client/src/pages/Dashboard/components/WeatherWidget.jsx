import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    MapPin,
    Droplets,
    Wind,
    Umbrella,
    RefreshCw,
    TriangleAlert,
    Sun,
    Moon,
    CloudSun,
    CloudMoon,
    Cloud,
    Cloudy,
    CloudDrizzle,
    CloudRain,
    CloudLightning,
    CloudSnow,
    CloudFog,
} from "lucide-react";
import { fetchWeather } from "../../../lib/authApi";

// OpenWeather condition codes -> lucide icons. The trailing d/n selects the
// day or night variant, so clear skies read as a sun by day and a moon at
// night. Anything unmapped falls back to a plain cloud rather than rendering
// nothing, since a missing glyph is more jarring than a slightly generic one.
const ICONS = {
    "01d": Sun,
    "01n": Moon,
    "02d": CloudSun,
    "02n": CloudMoon,
    "03d": Cloud,
    "03n": Cloud,
    "04d": Cloudy,
    "04n": Cloudy,
    "09d": CloudDrizzle,
    "09n": CloudDrizzle,
    "10d": CloudRain,
    "10n": CloudRain,
    "11d": CloudLightning,
    "11n": CloudLightning,
    "13d": CloudSnow,
    "13n": CloudSnow,
    "50d": CloudFog,
    "50n": CloudFog,
};

function WeatherIcon({ code, size, className }) {
    const Icon = ICONS[code] || Cloud;
    return <Icon size={size} className={className} strokeWidth={1.75} aria-hidden="true" />;
}

const CARD_CLASS = "bg-[#0f2442] rounded-2xl p-5 text-white shadow-lg flex flex-col gap-4";

const INITIAL_STATE = { status: "loading", weather: null, error: "" };

export default function WeatherWidget({ city }) {
    const [{ status, weather, error }, setState] = useState(INITIAL_STATE);
    // Bumped by the retry button to re-run the effect. State is never set
    // synchronously inside the effect body itself — only from the settled
    // promise — so a fetch cannot trigger a cascading render.
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!city) return undefined;
        const controller = new AbortController();

        fetchWeather(city)
            .then((data) => {
                if (controller.signal.aborted) return;
                setState({ status: "ready", weather: data.weather, error: "" });
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                setState({
                    status: "error",
                    weather: null,
                    error: err.message || "Unable to load weather.",
                });
            });

        return () => controller.abort();
    }, [city, reloadKey]);

    const retry = useCallback(() => {
        setState(INITIAL_STATE);
        setReloadKey((key) => key + 1);
    }, []);

    // ── Loading skeleton ──────────────────────────────────────────
    if (status === "loading") {
        return (
            <div className={CARD_CLASS} aria-busy="true" aria-label="Loading weather">
                <div className="h-3 w-32 rounded bg-white/15 animate-pulse" />
                <div className="flex items-center justify-between">
                    <div className="h-12 w-24 rounded bg-white/15 animate-pulse" />
                    <div className="h-12 w-12 rounded-full bg-white/15 animate-pulse" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-14 rounded-xl bg-white/10 animate-pulse" />
                    ))}
                </div>
                <div className="grid grid-cols-5 gap-1 pt-3 border-t border-white/10">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-16 rounded-lg bg-white/10 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    // ── Error state ───────────────────────────────────────────────
    if (status === "error") {
        return (
            <div className={CARD_CLASS}>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{city}</span>
                </div>
                <div className="flex flex-col items-center text-center gap-2 py-4">
                    <TriangleAlert size={26} className="text-amber-300" />
                    <p className="text-sm font-semibold text-white/85">Weather unavailable</p>
                    <p className="text-xs text-white/55 leading-snug">{error}</p>
                    <button
                        type="button"
                        onClick={retry}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition-colors"
                    >
                        <RefreshCw size={12} />
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    if (!weather) return null;

    const { location, current, forecast } = weather;

    const metrics = [
        { label: "Humidity", value: `${current.humidity}%`, Icon: Droplets },
        { label: "Wind", value: `${Math.round(current.windKph)} km/h`, Icon: Wind },
        { label: "Rain", value: `${current.precipitationChance}%`, Icon: Umbrella },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={CARD_CLASS}
        >
            {/* Header — min-w-0 + truncate so a long city name shortens instead
                of pushing the date past the card's right edge. */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white/70 min-w-0">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{location.label}</span>
                </div>
                <span className="text-xs font-semibold text-white/60 whitespace-nowrap shrink-0">
                    {current.localDate}
                </span>
            </div>

            {/* Main temp + condition icon */}
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-black tracking-tight leading-none">
                            {current.tempC}
                        </span>
                        <span className="text-2xl font-bold text-white/70 leading-none">°C</span>
                    </div>
                    <p className="text-sm font-semibold text-white/80 mt-1.5 truncate">
                        {current.condition}
                    </p>
                    <p className="text-xs text-white/50 mt-0.5">
                        H {current.highC}° · L {current.lowC}° · Feels {current.feelsLikeC}°
                    </p>
                </div>

                <WeatherIcon
                    code={current.icon}
                    size={58}
                    className="text-[#8ec5ff] shrink-0 drop-shadow"
                />
            </div>

            {/* Metrics — a 3-up grid instead of a side column, so the labels
                never collide with the temperature on a narrow card. */}
            <div className="grid grid-cols-3 gap-2">
                {metrics.map(({ label, value, Icon }) => (
                    <div
                        key={label}
                        className="bg-white/5 rounded-xl px-2 py-2 flex flex-col items-center gap-0.5 min-w-0"
                    >
                        <Icon size={14} className="text-blue-300 shrink-0" />
                        <span className="text-[10px] font-semibold text-white/55 leading-none">
                            {label}
                        </span>
                        <span className="text-xs font-bold text-white leading-none whitespace-nowrap">
                            {value}
                        </span>
                    </div>
                ))}
            </div>

            {/* 5-day forecast */}
            <div className="grid grid-cols-5 gap-1 pt-3 border-t border-white/10">
                {forecast.map((day) => (
                    <div
                        key={day.date}
                        className="flex flex-col items-center gap-1 min-w-0"
                        title={`${day.condition} · ${day.precipitationChance}% rain`}
                    >
                        <span className="text-[11px] font-bold text-white/60">{day.day}</span>
                        <WeatherIcon code={day.icon} size={18} className="text-[#8ec5ff]" />
                        <span className="text-xs font-bold text-white">{day.highC}°</span>
                        <span className="text-[10px] text-white/50">{day.lowC}°</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
