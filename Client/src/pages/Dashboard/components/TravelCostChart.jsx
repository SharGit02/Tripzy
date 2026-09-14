import { motion } from "framer-motion";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Info, TrendingUp } from "lucide-react";

function formatINR(value) {
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
    return `₹${value}`;
}

export default function TravelCostChart({ costView, loading = false }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#0f2442]">Travel costs this year</h2>
                    <Info
                        size={14}
                        className="text-slate-400 cursor-help"
                        title="From your itineraries, fare searches, and bookings"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
                {costView?.series?.map((s) => (
                    <span key={s.mode} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <span className="inline-block w-5 h-0.5 rounded-full" style={{ background: s.color }} />
                        {s.mode}
                    </span>
                ))}
            </div>

            {loading || !costView ? (
                <div className="h-52 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={costView.transformed} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tickFormatter={formatINR}
                            tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                            width={38}
                        />
                        <Tooltip
                            formatter={(val, name) => [`₹${Number(val).toLocaleString("en-IN")}`, name]}
                            contentStyle={{
                                background: "#fff",
                                border: "1px solid #e2e8f0",
                                borderRadius: "10px",
                                fontSize: "12px",
                                fontWeight: 600,
                            }}
                        />
                        {costView.series.map((s) => (
                            <Line
                                key={s.mode}
                                type="monotone"
                                dataKey={s.mode}
                                stroke={s.color}
                                strokeWidth={2.5}
                                dot={{ r: 4, fill: s.color, strokeWidth: 2, stroke: "#fff" }}
                                activeDot={{ r: 6 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            )}

            {costView?.insight && (
                <div className="flex items-start gap-2 bg-[#f8fafc] rounded-xl px-3 py-2.5 border border-slate-100">
                    <TrendingUp size={15} className="text-[#2563EB] mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-medium text-slate-500 leading-relaxed">{costView.insight}</p>
                </div>
            )}
        </motion.div>
    );
}
