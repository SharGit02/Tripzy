import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SearchBar() {
    const [date, setDate] = useState("");
    const [destination, setDestination] = useState("");
    const navigate = useNavigate();

    const handleSearch = (e) => {
        e.preventDefault();
        if (destination.trim()) {
            // Navigate to catalog with search query
            navigate(`/catalog?q=${encodeURIComponent(destination.trim())}`);
        }
    };

    return (
        <motion.form
            onSubmit={handleSearch}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4"
        >
            {/* When? */}
            <div className="flex items-center gap-3 flex-1 min-w-0 border-r border-slate-200 pr-4">
                <Calendar size={18} className="text-slate-400 flex-shrink-0" />
                <div className="flex flex-col min-w-0 w-full">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        When?
                    </span>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="text-sm font-semibold text-[#0f2442] bg-transparent outline-none w-full cursor-pointer"
                        style={{ colorScheme: "light" }}
                        placeholder="Select dates"
                    />
                </div>
            </div>

            {/* Where? */}
            <div className="flex items-center gap-3 flex-[2] min-w-0 pl-2">
                <MapPin size={18} className="text-slate-400 flex-shrink-0" />
                <div className="flex flex-col min-w-0 w-full">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Where?
                    </span>
                    <input
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="Search destination"
                        className="text-sm font-semibold text-[#0f2442] bg-transparent outline-none w-full placeholder:text-slate-300 placeholder:font-normal"
                    />
                </div>
            </div>

            {/* Search Button */}
            <button
                type="submit"
                className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors flex-shrink-0 shadow-sm"
            >
                <Search size={15} />
                Search
            </button>
        </motion.form>
    );
}
