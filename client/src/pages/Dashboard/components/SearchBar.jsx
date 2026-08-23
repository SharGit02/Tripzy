import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Search, PlaneTakeoff, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLocationContext } from "../../../context/LocationContext";
import LocationDropdown from "../../../components/layout/LocationDropdown";

export default function SearchBar() {
    const [date, setDate] = useState("");
    const [destination, setDestination] = useState("");
    const navigate = useNavigate();

    const { currentCity } = useLocationContext();
    const [departureOpen, setDepartureOpen] = useState(false);
    const departureRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (departureRef.current && !departureRef.current.contains(e.target)) {
                setDepartureOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        if (destination.trim()) {
            navigate(`/catalog?q=${encodeURIComponent(destination.trim())}`);
        }
    };

    return (
        <motion.form
            onSubmit={handleSearch}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 w-full overflow-visible"
        >
            {/* Departure */}
            <div ref={departureRef} className="relative flex items-center gap-3 flex-1 min-w-0 border-r border-slate-200 pr-4">
                <div className="flex items-start gap-3 w-full">
                    <PlaneTakeoff size={18} className="text-[#2563EB] flex-shrink-0 mt-1" />
                    <div className="flex flex-col min-w-0 w-full select-none">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Departure City
                        </span>
                        <button
                            type="button"
                            onClick={() => setDepartureOpen((prev) => !prev)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-blue-50/70 border border-slate-200/80 hover:border-blue-200 transition-all text-xs font-bold text-slate-800 self-start"
                        >
                            <span className="truncate max-w-[85px] sm:max-w-[110px]">
                                {currentCity}
                            </span>
                            <span className="text-[9px] font-extrabold uppercase text-[#9FADB6] bg-blue-100/80 px-1.5 py-0.5 rounded-md tracking-wider">
                                CURRENT
                            </span>
                            <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${departureOpen ? 'rotate-180 text-[#2563EB]' : ''}`} />
                        </button>
                    </div>
                </div>
                <LocationDropdown isOpen={departureOpen} setIsOpen={setDepartureOpen} align="left" />
            </div>

            {/* When? */}
            <div className="flex items-center gap-3 flex-1 min-w-0 border-r border-slate-200 pr-4 pl-2">
                <Calendar size={18} className="text-slate-400 flex-shrink-0" />
                <div className="flex flex-col min-w-0 w-full">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        When?
                    </span>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="text-sm font-semibold text-[#0f2442] bg-transparent outline-none w-full cursor-pointer mt-0.5"
                        style={{ colorScheme: "light" }}
                        placeholder="Select dates"
                    />
                </div>
            </div>

            {/* Where? */}
            <div className="flex items-center gap-3 flex-[1.5] min-w-0 pl-2">
                <MapPin size={18} className="text-slate-400 flex-shrink-0" />
                <div className="flex flex-col min-w-0 w-full">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Destination
                    </span>
                    <input
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="Where to?"
                        className="text-sm font-semibold text-[#0f2442] bg-transparent outline-none w-full placeholder:text-slate-300 placeholder:font-normal mt-0.5"
                    />
                </div>
            </div>

            {/* Search Button */}
            <button
                type="submit"
                className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-bold px-6 py-3 rounded-xl transition-colors flex-shrink-0 shadow-sm ml-2"
            >
                <Search size={15} />
                Search
            </button>
        </motion.form>
    );
}
