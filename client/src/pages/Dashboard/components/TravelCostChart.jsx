import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Info, TrendingUp } from "lucide-react";
import { fetchTravelCosts } from "../data/travelCostsMock";

const YEARS = [2026, 2025];

function formatINR(value) {
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
    return `₹${value}`;
}

export default function TravelCostChart() {
    const [year, setYear] = useState(2026);
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetchTravelCosts(year).then((data) => {
            // Transform for Recharts: [{month, Train, Bus, Flight}, ...]
            const transformed = data.months.map((month, i) => {
                const point = { month };
                data.series.forEach((s) => {
                    point[s.mode] = s.data[i];
                });
                return point;
            });
            setChartData({ ...data, transformed });
            setLoading(false);
        });
    }, [year]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#0f2442]">Travel Cost Trends</h2>
                    <Info size={14} className="text-slate-400 cursor-help" title="Average cost per transport mode per month" />
                </div>
                <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="text-xs font-semibold text-[#2563EB] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none cursor-pointer hover:border-[#2563EB] transition-colors"
                >
                    {YEARS.map((y) => (
                        <option key={y} value={y}>
                            {y === 2026 ? "This Year" : y}
                        </option>
                    ))}
                </select>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4">
                {chartData?.series.map((s) => (
                    <span key={s.mode} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <span className="inline-block w-5 h-0.5 rounded-full" style={{ background: s.color }} />
                        {s.mode}
                    </span>
                ))}
            </div>

            {/* Chart */}
            {loading || !chartData ? (
                <div className="h-52 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData.transformed} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
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
                            formatter={(val, name) => [`₹${val.toLocaleString("en-IN")}`, name]}
                            contentStyle={{
                                background: "#fff",
                                border: "1px solid #e2e8f0",
                                borderRadius: "10px",
                                fontSize: "12px",
                                fontWeight: 600,
                            }}
                        />
                        {chartData.series.map((s) => (
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

            {/* Insight */}
            {chartData?.insight && (
                <div className="flex items-start gap-2 bg-[#f8fafc] rounded-xl px-3 py-2.5 border border-slate-100">
                    <TrendingUp size={15} className="text-[#2563EB] mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-medium text-slate-500 leading-relaxed">{chartData.insight}</p>
                </div>
            )}
        </motion.div>
    );
}
