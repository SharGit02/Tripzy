import React, { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { fetchFlightFarePrediction } from "../../lib/authApi";

// Helper to format currency
const formatCurrency = (value) => {
  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(0)}K`;
  }
  return `₹${value}`;
};

export default function PriceHistoryGraph({ itinerary, sourceCity }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("15 Days");

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      
      const rawOrigin = sourceCity || itinerary?.origin || "Delhi";
      const rawDest = itinerary?.destination || "Goa";
      
      let windowDays = 15;
      let offsetDays = 7;
      if (timeRange === "30 Days") {
        windowDays = 30;
        offsetDays = 15;
      } else if (timeRange === "90 Days") {
        windowDays = 90;
        offsetDays = 45;
      }

      // Determine start date - offset days
      const baseDate = itinerary?.startDate ? new Date(itinerary.startDate) : new Date();
      baseDate.setDate(baseDate.getDate() - offsetDays);
      const startDateStr = baseDate.toISOString().substring(0, 10);
      
      try {
        const response = await fetchFlightFarePrediction({
          origin: rawOrigin,
          destination: rawDest,
          startDate: startDateStr,
          windowDays: windowDays,
        });

        const quotes =
          response?.prediction?.results?.quotes ||
          response?.results?.quotes ||
          response?.quotes ||
          [];
          
        if (quotes.length > 0) {
          // Group by date, find minimum fare for each day
          const groupedByDate = {};
          quotes.forEach(q => {
            const date = q.date;
            const fare = Number(q.predictedFare ?? q.predicted_fare ?? 0);
            if (fare > 0) {
              if (!groupedByDate[date] || fare < groupedByDate[date]) {
                groupedByDate[date] = fare;
              }
            }
          });
          
          const chartData = Object.keys(groupedByDate).sort().map(date => {
            const dateObj = new Date(date);
            return {
              rawDate: date,
              displayDate: dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
              fare: groupedByDate[date]
            };
          });
          
          setData(chartData);
        } else {
          setData([]);
        }
      } catch (err) {
        console.error("Failed to fetch price history:", err);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [itinerary, sourceCity, timeRange]);

  if (loading && data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-8 h-[300px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  if (data.length === 0 && !loading) {
    return null; // Don't show graph if no data
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">Price History</h2>
        <div className="flex gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100 mt-3 sm:mt-0">
          {["15 Days", "30 Days", "90 Days"].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                timeRange === range
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorFare" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fca5a5" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#86efac" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="displayDate" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: "#64748b" }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tickFormatter={formatCurrency}
              tick={{ fontSize: 12, fill: "#64748b" }}
              domain={[
                (dataMin) => Math.max(0, Math.floor(dataMin - (dataMin * 0.02))), 
                (dataMax) => Math.ceil(dataMax + (dataMax * 0.02))
              ]}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
              formatter={(value) => [`₹${value.toLocaleString()}`, 'Predicted Fare']}
              labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
            />
            <Area 
              type="stepAfter" 
              dataKey="fare" 
              stroke="#f87171" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorFare)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
