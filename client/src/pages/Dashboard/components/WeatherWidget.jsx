import { motion } from "framer-motion";
import { MapPin, Droplets, Wind, CloudRain } from "lucide-react";

// Dynamic 5-day forecast relative to today (21 Aug 2026 per system time)
function getForecast() {
    const today = new Date(2026, 7, 21); // Aug 21 2026
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const forecasts = [
        { high: 32, low: 24, icon: "⛅" },
        { high: 31, low: 23, icon: "🌤️" },
        { high: 30, low: 23, icon: "☀️" },
        { high: 28, low: 22, icon: "🌧️" },
        { high: 27, low: 21, icon: "🌦️" },
    ];
    return forecasts.map((f, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return { ...f, day: dayNames[d.getDay()] };
    });
}

const WEATHER = {
    city: "Nagpur, India",
    date: "21 Aug 2026",
    temp: "24°C",
    condition: "Partly Cloudy",
    high: 32,
    low: 24,
    humidity: 62,
    wind: 9,
    precipitation: 20,
};

export default function WeatherWidget() {
    const forecast = getForecast();

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-[#0f2442] rounded-2xl p-5 text-white shadow-lg flex flex-col gap-4"
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
                    <MapPin size={12} />
                    {WEATHER.city}
                </div>
                <span className="text-xs font-semibold text-white/60">{WEATHER.date}</span>
            </div>

            {/* Main temp + icon */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="text-5xl font-black tracking-tight">{WEATHER.temp}</span>
                        <span className="text-4xl" role="img" aria-label="partly cloudy">⛅</span>
                    </div>
                    <p className="text-sm font-semibold text-white/80 mt-1">{WEATHER.condition}</p>
                    <p className="text-xs text-white/50 mt-0.5">
                        H {WEATHER.high}° &nbsp; L {WEATHER.low}°
                    </p>
                </div>

                {/* Stats */}
                <div className="flex flex-col gap-2 text-xs text-white/70">
                    <div className="flex items-center gap-2">
                        <Droplets size={13} className="text-blue-300" />
                        <span>Humidity</span>
                        <span className="font-bold text-white ml-auto pl-3">{WEATHER.humidity}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Wind size={13} className="text-blue-300" />
                        <span>Wind</span>
                        <span className="font-bold text-white ml-auto pl-3">{WEATHER.wind} km/h</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CloudRain size={13} className="text-blue-300" />
                        <span>Precipitation</span>
                        <span className="font-bold text-white ml-auto pl-3">{WEATHER.precipitation}%</span>
                    </div>
                </div>
            </div>

            {/* 5-day forecast */}
            <div className="grid grid-cols-5 gap-1 pt-3 border-t border-white/10">
                {forecast.map((f, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                        <span className="text-[11px] font-bold text-white/60">{f.day}</span>
                        <span className="text-lg leading-none" role="img" aria-label="weather">{f.icon}</span>
                        <span className="text-xs font-bold text-white">{f.high}°</span>
                        <span className="text-[10px] text-white/50">{f.low}°</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
