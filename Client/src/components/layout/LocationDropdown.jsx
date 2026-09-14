import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, Loader2, Search, Check } from "lucide-react";
import { CITIES_LIST, nearestCity, useLocationContext } from "../../context/LocationContext";

export default function LocationDropdown({ isOpen, setIsOpen, align = "right" }) {
    const { currentCity, setCurrentCity } = useLocationContext();
    const [searchQuery, setSearchQuery] = useState("");
    const [isDetectingLocation, setIsDetectingLocation] = useState(false);
    const [locationNotice, setLocationNotice] = useState("");

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            setLocationNotice("Geolocation not supported by browser.");
            return;
        }
        setIsDetectingLocation(true);
        setLocationNotice("");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const { city, km } = nearestCity(latitude, longitude);
                setIsDetectingLocation(false);
                setCurrentCity(city);
                setLocationNotice(
                    km < 80
                        ? `Detected ${city} from your GPS.`
                        : `Closest listed city is ${city} (${km} km away).`,
                );
                setTimeout(() => setLocationNotice(""), 3500);
            },
            (error) => {
                setIsDetectingLocation(false);
                setLocationNotice("Permission denied or location unavailable.");
                setTimeout(() => setLocationNotice(""), 2500);
            },
            { timeout: 12000, enableHighAccuracy: true, maximumAge: 0 }
        );
    };

    const filteredCities = CITIES_LIST.filter((city) =>
        city.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-3 w-80 bg-white rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-slate-200 z-50 text-left`}
                >
                    {/* Pointer Arrow */}
                    <div className={`absolute -top-2 ${align === "right" ? "right-10" : "left-10"} w-4 h-4 bg-white border-t border-l border-slate-200 rotate-45 z-20`} />

                    <div className="relative z-10 space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                                    <MapPin size={15} />
                                </div>
                                <div>
                                    <h3 className="text-xs font-black text-[#0f2442] uppercase tracking-wider">
                                        Select Location
                                    </h3>
                                    <p className="text-[10px] text-slate-400">
                                        Choose active city for recommendations
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Enable Location Permission Card */}
                        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/60 border border-slate-200/80 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-[#0f2442]">
                                    ENABLE LOCATION PERMISSION
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">
                                    Detect current location automatically
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleDetectLocation}
                                disabled={isDetectingLocation}
                                className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs whitespace-nowrap disabled:opacity-60"
                            >
                                {isDetectingLocation ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <Navigation size={13} />
                                )}
                                <span>{isDetectingLocation ? "Detecting..." : "ALLOW"}</span>
                            </button>
                        </div>

                        {locationNotice && (
                            <p className="text-[11px] font-semibold text-center text-blue-600">
                                {locationNotice}
                            </p>
                        )}

                        {/* Search Bar Input */}
                        <div className="relative">
                            <Search
                                size={14}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search city (e.g. Delhi, Hyderabad)..."
                                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 outline-none focus:border-[#2563EB] focus:bg-white transition-all font-medium"
                            />
                        </div>

                        {/* Scrollable City List */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">
                                Available Cities ({filteredCities.length})
                            </p>
                            <div className="max-h-48 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                                {filteredCities.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-4">
                                        No cities found matching "{searchQuery}"
                                    </p>
                                ) : (
                                    filteredCities.map((city) => {
                                        const isSelected =
                                            city.toLowerCase() === currentCity.toLowerCase();
                                        return (
                                            <button
                                                key={city}
                                                type="button"
                                                onClick={() => {
                                                    setCurrentCity(city);
                                                    setIsOpen(false);
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${isSelected
                                                    ? "bg-blue-50 text-[#2563EB] font-bold border border-blue-100"
                                                    : "text-slate-700 hover:bg-slate-50 hover:text-[#2563EB]"
                                                    }`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <MapPin
                                                        size={13}
                                                        className={
                                                            isSelected
                                                                ? "text-[#2563EB]"
                                                                : "text-slate-400"
                                                        }
                                                    />
                                                    {city}
                                                </span>
                                                {isSelected ? (
                                                    <span className="flex items-center gap-1 text-[10px] uppercase font-extrabold text-[#2563EB] bg-blue-100/80 px-2 py-0.5 rounded-md">
                                                        <Check size={11} /> CURRENT
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">
                                                        Select
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
