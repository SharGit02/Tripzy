import { motion } from "framer-motion";
import { IndianRupee, Plane, Info } from "lucide-react";

function formatDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function QuoteRow({ quote, isBest }) {
    return (
        <div
            className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                isBest ? "border-[#2563EB]/30 bg-[#EAF1FF]/50" : "border-slate-100"
            }`}
        >
            <div className="flex items-center gap-3 min-w-0">
                <Plane size={15} className="text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0f2442] truncate">
                        {quote.airline} · #{quote.flightNumber}
                    </p>
                    <p className="text-xs text-slate-500">
                        {formatDate(quote.date)} · {quote.dayOfWeek}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {isBest && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5">
                        Cheapest
                    </span>
                )}
                <span className="text-sm font-bold text-[#0f2442]">₹{quote.predictedFare.toLocaleString("en-IN")}</span>
            </div>
        </div>
    );
}

// Pure presentational component: renders a persisted flight_fare_predictions
// row (as returned by GET/POST /api/flight-fare/...). Day-by-day quotes live
// under prediction.results.quotes; the cheapest day is denormalized into
// bestDate/bestAirline/bestFlightNumber/bestPredictedFare (a string —
// Postgres numeric columns come back as text via pg). The matching quote
// object (with dayOfWeek) is looked up from results.quotes rather than
// re-derived here.
export default function FarePricesSection({ prediction }) {
    if (!prediction) return null;

    const allQuotes = prediction.results?.quotes ?? [];
    const daysWithNoFlights = prediction.results?.daysWithNoFlights ?? [];
    const best = prediction.bestDate
        ? allQuotes.find(
              (q) => q.date === prediction.bestDate && q.flightNumber === prediction.bestFlightNumber
          ) ?? {
              date: prediction.bestDate,
              dayOfWeek: "",
              airline: prediction.bestAirline,
              flightNumber: prediction.bestFlightNumber,
              predictedFare: Number(prediction.bestPredictedFare),
          }
        : null;

    return (
        <div className="flex flex-col gap-4">
            {best ? (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0f2442] rounded-2xl p-5 text-white shadow-lg flex flex-col gap-2"
                >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
                        <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wide rounded-full px-2.5 py-0.5">
                            Cheapest day
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-lg font-bold">
                                {formatDate(best.date)} · {best.dayOfWeek}
                            </p>
                            <p className="text-sm text-white/70 mt-0.5">
                                {best.airline} · Flight #{best.flightNumber}
                            </p>
                        </div>
                        <div className="flex items-center gap-1 text-3xl font-black">
                            <IndianRupee size={22} />
                            {best.predictedFare.toLocaleString("en-IN")}
                        </div>
                    </div>
                </motion.div>
            ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 p-4 text-sm font-medium">
                    No scheduled flights were found for this route across the scanned window. Try a wider window or a
                    different route.
                </div>
            )}

            {allQuotes.length > 0 && (
                <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-5 flex flex-col gap-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Day-by-day fares ({allQuotes.length})
                    </p>
                    {/* A dense route over a 30-day window easily returns 300-500+
                        flight/day combinations - scroll instead of rendering an
                        unbounded page. */}
                    <div className="flex flex-col gap-2 max-h-[28rem] overflow-y-auto pr-1">
                        {allQuotes.map((quote) => (
                            <QuoteRow
                                key={`${quote.date}-${quote.airline}-${quote.flightNumber}`}
                                quote={quote}
                                isBest={best && quote.date === best.date && quote.flightNumber === best.flightNumber}
                            />
                        ))}
                    </div>
                </div>
            )}

            {daysWithNoFlights.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Info size={13} className="flex-shrink-0" />
                    No scheduled flights found for {daysWithNoFlights.length} of the {prediction.windowDays} days
                    scanned.
                </p>
            )}
        </div>
    );
}
