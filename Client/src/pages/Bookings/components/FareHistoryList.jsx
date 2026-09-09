import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, MapPin, Calendar } from "lucide-react";

function formatDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function FareHistoryList({ history, loading }) {
    if (loading) {
        return (
            <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-8">
                <p className="text-sm text-slate-500">Loading your past searches...</p>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-12 text-center">
                <TrendingUp size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-base font-semibold text-[#0f2442] mb-1">No fare searches yet</p>
                <p className="text-sm text-slate-500">Search a trip on the Catalog page and it'll show up here.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {history.map((entry) => {
                const searchedOn = formatDate(entry.searchStartDate);
                const searchedAt = formatDate(entry.createdAt);
                const bestDate = formatDate(entry.bestDate);
                const bestFare = entry.bestPredictedFare != null ? Number(entry.bestPredictedFare) : null;

                return (
                    <motion.div key={entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <Link
                            to={`/trip/${entry.id}`}
                            className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between hover:border-[#2563EB]/30 transition-colors"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <h2 className="text-lg font-bold text-[#0f2442]">
                                        {entry.origin} → {entry.destination}
                                    </h2>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                                    <span className="flex items-center gap-1.5">
                                        <Calendar size={14} />
                                        From {searchedOn} · {entry.windowDays}-day scan
                                    </span>
                                    {searchedAt && (
                                        <span className="flex items-center gap-1.5">
                                            <MapPin size={14} />
                                            Searched {searchedAt}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col items-start sm:items-end gap-0.5">
                                {bestFare != null ? (
                                    <>
                                        <p className="text-base font-bold text-[#0f2442]">
                                            ₹{bestFare.toLocaleString("en-IN")}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {entry.bestAirline} · {bestDate}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-400">No flights found</p>
                                )}
                            </div>
                        </Link>
                    </motion.div>
                );
            })}
        </div>
    );
}
