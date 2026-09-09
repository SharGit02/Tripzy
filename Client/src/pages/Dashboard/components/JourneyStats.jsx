import { motion } from "framer-motion";
import { Luggage, MapPin, Map, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import adventureImg from "../../../assets/images/Ladakh.png";

export default function JourneyStats({ trips = 0, places = 0, itineraries = 2 }) {
    const stats = [
        { icon: Luggage, value: String(trips).padStart(2, "0"), label: "Trips", sub: "Keep exploring!" },
        { icon: MapPin, value: String(places).padStart(2, "0"), label: "Places", sub: "Destinations visited" },
        { icon: Map, value: String(itineraries).padStart(2, "0"), label: "Itineraries", sub: "Plans created" },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] items-stretch gap-0 rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm"
        >
            {/* Left — label + luggage */}
            <div className="flex items-center gap-4 bg-[#f8fafc] px-6 py-6 border-r border-slate-100">
                <span className="text-5xl" role="img" aria-label="luggage">🧳</span>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                        Your Journey
                    </p>
                    <p className="text-lg font-black text-[#0f2442] leading-tight">So Far</p>
                </div>
            </div>

            {/* Center — stat boxes */}
            <div className="grid grid-cols-3 divide-x divide-slate-100">
                {stats.map(({ icon: Icon, value, label, sub }, i) => (
                    <div key={i} className="flex flex-col items-center justify-center gap-1 py-5 px-4">
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1 ${i === 0
                                ? "bg-blue-50 text-blue-600"
                                : i === 1
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-purple-50 text-purple-600"
                                }`}
                        >
                            <Icon size={18} />
                        </div>
                        <p className="text-3xl font-black text-[#0f2442] leading-none">{value}</p>
                        <p className="text-sm font-bold text-slate-600">{label}</p>
                        <p className="text-[11px] text-slate-400">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Right — adventure CTA */}
            <div className="relative flex items-center overflow-hidden min-w-[220px]">
                <img
                    src={adventureImg}
                    alt="Adventure awaits"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-transparent via-black/30 to-black/60" />
                <div className="relative z-10 p-5">
                    <p className="text-base font-black text-white leading-tight mb-1">
                        Your next adventure<br />is waiting.
                    </p>
                    <p className="text-xs text-white/80 mb-3">
                        Find a destination worth remembering.
                    </p>
                    <Link
                        to="/plan"
                        className="inline-flex items-center gap-1.5 bg-white text-[#0f2442] text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors shadow-sm"
                    >
                        Plan a Trip
                        <ArrowRight size={12} />
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}
