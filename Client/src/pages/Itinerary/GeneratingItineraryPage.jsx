import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ClockLoader } from "react-spinners";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import UserNavbar from "../../components/layout/UserNavbar";
import Footer from "../../components/layout/Footer";
import { generateItinerary } from "../../lib/authApi";

export default function GeneratingItineraryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const payload = location.state?.payload;
  const hasCalled = useRef(false);

  const doGenerate = useCallback(async () => {
    if (!payload) {
      navigate("/plan", { replace: true });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await generateItinerary(payload);
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
        <main className="pt-32 px-4 sm:px-8 pb-16 max-w-7xl mx-auto w-full flex flex-col items-center justify-center min-h-[60vh]">
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
            <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-12 text-center max-w-md mx-auto">
              <div className="flex justify-center mb-6">
                <ClockLoader color="#36d7b7" size={60} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Creating your itinerary...</h2>
              <p className="text-slate-500">This may take a minute while we plan every detail.</p>
            </div>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
}
