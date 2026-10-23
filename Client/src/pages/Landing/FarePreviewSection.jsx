import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plane, Train, Bus, TrendingDown, Info } from "lucide-react";

/**
 * Illustrative sample of the fare view — static numbers, labelled as a sample
 * so it is never mistaken for a live quote.
 */
const fareTrend = [
  { week: "8 wks out", actual: 6200, predicted: 6100 },
  { week: "7 wks", actual: 5900, predicted: 5850 },
  { week: "6 wks", actual: 5400, predicted: 5500 },
  { week: "5 wks", actual: 5150, predicted: 5200 },
  { week: "4 wks", actual: 5600, predicted: 5450 },
  { week: "3 wks", actual: 6400, predicted: 6250 },
  { week: "2 wks", actual: 7450, predicted: 7300 },
  { week: "1 wk", actual: 8900, predicted: 8600 },
];

const modes = [
  { icon: Plane, label: "Flight", value: "₹5,150", note: "approx. 2h 10m", best: true },
  { icon: Train, label: "Train", value: "₹1,480", note: "approx. 17h 40m", best: false },
  { icon: Bus, label: "Bus", value: "₹1,100", note: "approx. 21h 15m", best: false },
];

function FareTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#386FA4]/20 bg-white/95 backdrop-blur px-3.5 py-2.5 shadow-lg">
      <p className="text-[11px] font-bold tracking-wider uppercase text-[#386FA4] font-sans-dm mb-1">
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-[13px] font-semibold text-[#0D324D]">
          <span style={{ color: entry.color }}>&#9632;</span>{" "}
          {entry.dataKey === "actual" ? "Observed" : "Predicted"}: ₹
          {entry.value.toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
}

export default function FarePreviewSection() {
  return (
    <section
      id="fare-preview"
      className="relative py-24 px-6 overflow-hidden bg-[#F4F9FD]"
    >
      <div
        className="absolute top-10 right-0 w-[420px] h-[420px] rounded-full pointer-events-none opacity-20"
        style={{ background: "#59A5D8", filter: "blur(150px)" }}
      />

      <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* ── Copy ── */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-5"
        >
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-[0.18em] text-[#133C55] bg-white/70 backdrop-blur border border-[#59A5D8]/40 uppercase mb-5">
            <TrendingDown size={13} strokeWidth={2.6} />
            Fare intelligence
          </span>
          <h2 className="font-display font-black text-[#050D1A] text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.08] tracking-tight mb-4">
            Book when the curve is in your favour.
          </h2>
          <p className="text-[#133C55]/80 text-base sm:text-lg leading-relaxed font-sans-dm font-medium mb-7">
            Tripzy models historical airfare movement for your route and shows where
            the predicted price sits against what the fare has actually done &mdash;
            next to the train and bus alternatives for the same trip.
          </p>

          <div className="space-y-3">
            {modes.map((mode) => {
              const Icon = mode.icon;
              return (
                <div
                  key={mode.label}
                  className={`flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-colors ${
                    mode.best
                      ? "border-[#386FA4]/40 bg-white shadow-[0_8px_24px_rgba(56,111,164,0.14)]"
                      : "border-[#386FA4]/15 bg-white/60"
                  }`}
                >
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                      mode.best
                        ? "bg-[#133C55] border-[#133C55] text-[#91E5F6]"
                        : "bg-[#91E5F6]/20 border-[#59A5D8]/35 text-[#133C55]"
                    }`}
                  >
                    <Icon size={18} strokeWidth={2.3} />
                  </span>
                  <div className="flex-1">
                    <p className="font-display font-bold text-[#0D324D] text-sm">
                      {mode.label}
                    </p>
                    <p className="text-[#386FA4] text-[11px] font-semibold font-sans-dm">
                      {mode.note}
                    </p>
                  </div>
                  <p className="font-mono font-bold text-[#133C55] text-sm">
                    {mode.value}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Chart card ── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-7 rounded-3xl border border-[#386FA4]/18 bg-white p-6 sm:p-7 shadow-[0_20px_55px_rgba(19,60,85,0.14)]"
        >
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="font-display font-bold text-[#0D324D] text-lg">
                Airfare trend by booking window
              </p>
              <p className="text-[#386FA4] text-xs font-semibold font-sans-dm mt-0.5">
                Delhi &rarr; Srinagar &middot; economy
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.14em] uppercase text-[#386FA4] bg-[#386FA4]/10 border border-[#386FA4]/25 px-2.5 py-1 rounded-full font-sans-dm flex-shrink-0">
              <Info size={11} strokeWidth={2.8} />
              Sample
            </span>
          </div>

          <div className="h-[260px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fareTrend} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="fareFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#59A5D8" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#91E5F6" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#386FA4" strokeOpacity={0.12} vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fill: "#386FA4", fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: "#386FA4", strokeOpacity: 0.2 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#386FA4", fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(value) => `₹${value / 1000}k`}
                />
                <Tooltip content={<FareTooltip />} />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#133C55"
                  strokeWidth={2.5}
                  fill="url(#fareFill)"
                  dot={{ r: 3, fill: "#133C55" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 pt-5 border-t border-[#386FA4]/12">
            <span className="flex items-center gap-2 text-xs font-semibold text-[#133C55] font-sans-dm">
              <span className="w-5 h-0.5 rounded-full bg-[#133C55]" />
              Observed fare
            </span>
            <span className="flex items-center gap-2 text-xs font-semibold text-[#133C55] font-sans-dm">
              <span
                className="w-5 h-0.5 rounded-full"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, #14b8a6 0 5px, transparent 5px 9px)",
                }}
              />
              Tripzy prediction
            </span>
            <span className="text-[11px] text-[#386FA4]/80 font-sans-dm font-medium ml-auto">
              Estimates only &mdash; not a bookable quote.
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
