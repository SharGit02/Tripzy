import { motion } from "framer-motion";
import { Map, TrendingUp, TrendingDown, Star, PlaneTakeoff, Ticket } from "lucide-react";

const MODE_ICONS = { Itineraries: Map, "Fare searches": PlaneTakeoff, Bookings: Ticket };
const MODE_COLORS = {
    Itineraries: { bg: "bg-blue-50", text: "text-blue-600" },
    "Fare searches": { bg: "bg-purple-50", text: "text-purple-600" },
    Bookings: { bg: "bg-green-50", text: "text-green-600" },
};

export default function TravelCostOverview({ costView }) {
    if (!costView) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4"
        >
            <h2 className="text-base font-bold text-[#0f2442]">Cost overview</h2>

            <div className="flex flex-col gap-3">
                {costView.overview.map((item) => {
                    const Icon = MODE_ICONS[item.mode] || PlaneTakeoff;
                    const colors = MODE_COLORS[item.mode] || MODE_COLORS.Itineraries;
                    const isNeg = item.change < 0;

                    return (
                        <div
                            key={item.mode}
                            className="flex items-center justify-between gap-3 rounded-xl bg-[#f8fafc] border border-slate-100 px-4 py-2.5"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.bg} ${colors.text}`}>
                                    <Icon size={16} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{item.mode}</p>
                                    <p className="text-[11px] text-slate-400">Monthly avg</p>
                                </div>
                            </div>
                            <p className="text-base font-black text-[#0f2442]">
                                ₹{item.avgCost.toLocaleString("en-IN")}
                            </p>
                            <div className={`flex items-center gap-1 text-xs font-bold ${isNeg ? "text-green-600" : "text-red-500"}`}>
                                {isNeg ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                                {Math.abs(item.change)}%
                                <span className="text-slate-400 font-normal ml-0.5">vs last month</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {costView.smartPick && (
                <div className="flex items-start gap-2.5 bg-[#ecfdf5] border border-emerald-100 rounded-xl px-4 py-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Star size={13} className="text-white fill-white" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-emerald-700 mb-0.5">Smart Pick</p>
                        <p className="text-xs text-emerald-600">{costView.smartPick}</p>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
