import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Check,
  Hotel,
  Plane,
  TrainFront,
  Bus,
  CloudSun,
  Sparkles,
  Receipt,
  Save,
} from "lucide-react";
import UserNavbar from "../../components/layout/UserNavbar";
import Footer from "../../components/layout/Footer";
import { generateItineraryStream } from "../../lib/authApi";

// The real stages itinerary.service.ts reports (its `onProgress` callback),
// each a genuine network call or compute step, not a timer. hotels/flights/
// trains/buses/weather all run CONCURRENTLY server-side, so they can arrive
// in any order — this page tracks completion as a set, not a linear pointer,
// and the bar fills by how many of these have actually happened.
const STEPS = [
  { stage: "hotels", label: "Checking hotels", icon: Hotel },
  { stage: "flights", label: "Checking flights", icon: Plane },
  { stage: "trains", label: "Checking trains", icon: TrainFront },
  { stage: "buses", label: "Checking buses", icon: Bus },
  { stage: "weather", label: "Checking the weather", icon: CloudSun },
  { stage: "ai", label: "Crafting your day-by-day plan", icon: Sparkles },
  { stage: "budget", label: "Reviewing your budget", icon: Receipt },
  { stage: "saving", label: "Finalizing your total estimate", icon: Save },
];

const STEP_KEYS = STEPS.map((s) => s.stage);

export default function GeneratingItineraryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(() => new Set());
  const payload = location.state?.payload;
  const hasCalled = useRef(false);

  const doGenerate = useCallback(async () => {
    if (!payload) {
      navigate("/plan", { replace: true });
      return;
    }

    setLoading(true);
    setError("");
    setDone(new Set());

    try {
      const data = await generateItineraryStream(payload, (event) => {
        if (!STEP_KEYS.includes(event.stage) && event.stage !== "done") return;
        setDone((prev) => {
          const next = new Set(prev);
          if (event.stage === "done") {
            STEP_KEYS.forEach((key) => next.add(key));
          } else {
            next.add(event.stage);
          }
          return next;
        });
      });
      const itineraryId = data.itineraryId || data.itinerary?.id;
      if (!itineraryId) {
        throw new Error("The itinerary was created, but we didn't get an ID back.");
      }
      navigate(`/plan/itinerary/${itineraryId}`, {
        replace: true,
        state: { fromCity: payload?.fromCity || payload?.origin, origin: payload?.origin || payload?.fromCity },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate itinerary. Please try again.";
      setError(msg);
      setLoading(false);
    }
  }, [payload, navigate]);

  useEffect(() => {
    if (!payload) {
      navigate("/plan", { replace: true });
      return;
    }

    if (hasCalled.current) return;
    hasCalled.current = true;

    doGenerate();
  }, [payload, navigate, doGenerate]);

  const pct = useMemo(() => {
    if (done.size === 0) return 4; // a sliver from the start, so the bar never looks dead
    return Math.round((done.size / STEPS.length) * 100);
  }, [done]);

  // The first not-yet-done step reads as "this is what's happening right
  // now" even though several steps genuinely run in parallel server-side.
  const activeLabel = STEPS.find((s) => !done.has(s.stage))?.label || "Wrapping up";

  const isAiBusy =
    error.toLowerCase().includes("busy") ||
    error.toLowerCase().includes("unavailable") ||
    error.toLowerCase().includes("503") ||
    error.toLowerCase().includes("500") ||
    error.toLowerCase().includes("overloaded") ||
    error.toLowerCase().includes("quota") ||
    error.toLowerCase().includes("ai") ||
    error.toLowerCase().includes("rate limit") ||
    error.toLowerCase().includes("problem on our side");

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#133C55] flex flex-col justify-between">
      <div>
        <UserNavbar />
        <main className="relative pt-32 px-4 sm:px-8 pb-16 max-w-7xl mx-auto w-full flex flex-col items-center justify-center min-h-[60vh] overflow-hidden">
          {/* Decorative banner behind the progress card — a journey/route
              illustration, light enough to sit behind content without
              fighting it for attention. Faded into the page background at
              the bottom so it reads as a backdrop, not a hard-edged image. */}
          <img
            src="/itinary/travel-landscape-banner.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-x-0 top-0 w-full h-72 sm:h-96 object-cover pointer-events-none select-none -z-10"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-72 sm:h-96 -z-10 bg-gradient-to-b from-transparent via-transparent to-[#F7F9FC]"
          />
          {error ? (
            <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-red-100 p-8 text-center max-w-md mx-auto">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                  <AlertCircle className="w-7 h-7" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {isAiBusy ? "AI Service Busy" : "Itinerary Generation Issue"}
              </h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                {isAiBusy
                  ? "Google AI servers are currently busy or experiencing high traffic. Please try again in a moment."
                  : error}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={doGenerate}
                  className="flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={() => navigate("/plan", { replace: true })}
                  className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-medium transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Go back to Plan
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-8 sm:p-12 text-center max-w-xl w-full mx-auto">
              <h2 className="text-2xl font-bold mb-1">
                {payload?.destination ? `Planning your trip to ${payload.destination}...` : "Creating your itinerary..."}
              </h2>
              <p className="text-slate-500 mb-8">{activeLabel}</p>

              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#36d7b7] to-[#2563EB] transition-[width] duration-700 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2 font-semibold">{pct}%</p>

              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                {STEPS.map((s) => {
                  const reached = done.has(s.stage);
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.stage}
                      className={`rounded-2xl border p-3 flex flex-col items-center text-center gap-2 transition-colors ${
                        reached
                          ? "border-[#2563EB]/30 bg-blue-50/60"
                          : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      <div
                        className={`relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          reached ? "bg-[#2563EB] text-white" : "bg-white text-slate-400 border border-slate-200"
                        } ${!reached ? "animate-pulse" : ""}`}
                      >
                        <Icon className="w-4 h-4" />
                        {reached && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] font-semibold leading-tight ${reached ? "text-slate-800" : "text-slate-400"}`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

    </div>
  );
}
