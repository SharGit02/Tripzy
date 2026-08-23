import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, ArrowRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import munnarImg from "../../../assets/images/Munnar.jpeg";

// Seasonal picks — swap out or extend with backend data later
const SEASONAL_PICKS = [
    {
        id: 1,
        badge: "Seasonal Pick",
        title: "Chase the Monsoon",
        location: "Munnar, Kerala",
        description:
            "Misty hills, lush tea gardens and cascading waterfalls—perfect for a refreshing escape.",
        image: munnarImg,
        link: "/catalog?q=Munnar",
    },
];

export default function SeasonalPick() {
    const [current, setCurrent] = useState(0);
    const pick = SEASONAL_PICKS[current];

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="relative overflow-hidden rounded-2xl shadow-sm"
            style={{ minHeight: "220px" }}
        >
            {/* Background image */}
            <img
                src={pick.image}
                alt={pick.title}
                className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            {/* Content */}
            <div className="relative z-10 p-5 flex flex-col justify-end h-full" style={{ minHeight: "220px" }}>
                {/* Badge */}
                <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 bg-white/90 text-[#7c3aed] text-[11px] font-bold px-3 py-1 rounded-full shadow-sm">
                        <Star size={11} className="fill-[#7c3aed] text-[#7c3aed]" />
                        {pick.badge}
                    </span>
                </div>

                {/* Bottom info */}
                <div className="mt-auto">
                    <h3 className="text-xl font-black text-white leading-tight">{pick.title}</h3>
                    <div className="flex items-center gap-1 text-white/70 text-xs mt-1">
                        <MapPin size={11} />
                        {pick.location}
                    </div>
                    <p className="text-xs text-white/80 mt-2 leading-relaxed line-clamp-2">
                        {pick.description}
                    </p>
                    <Link
                        to={pick.link}
                        className="mt-3 inline-flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                    >
                        Explore {pick.location.split(",")[0]}
                        <ArrowRight size={13} />
                    </Link>
                </div>
            </div>

            {/* Dot pagination */}
            {SEASONAL_PICKS.length > 1 && (
                <div className="absolute bottom-3 right-4 flex gap-1.5 z-10">
                    {SEASONAL_PICKS.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrent(i)}
                            className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-white w-4" : "bg-white/50"
                                }`}
                        />
                    ))}
                </div>
            )}
        </motion.div>
    );
}
