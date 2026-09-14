import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ClockLoader } from "react-spinners";
import UserNavbar from "../../components/layout/UserNavbar";
import Footer from "../../components/layout/Footer";
import { generateItinerary } from "../../lib/authApi";

export default function GeneratingItineraryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const payload = location.state?.payload;
  const hasCalled = useRef(false);

  useEffect(() => {
    if (!payload) {
      navigate("/plan", { replace: true });
      return;
    }
    
    if (hasCalled.current) return;
    hasCalled.current = true;

    async function doGenerate() {
      try {
        const data = await generateItinerary(payload);
        const itineraryId = data.itineraryId || data.itinerary?.id;
        if (!itineraryId) {
          throw new Error("The itinerary was created, but we didn't get an ID back.");
        }
        navigate(`/plan/itinerary/${itineraryId}`, { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate itinerary. Please try again.");
      }
    }

    doGenerate();
  }, [payload, navigate]);

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#133C55] flex flex-col justify-between">
      <div>
        <UserNavbar />
        <main className="pt-32 px-4 sm:px-8 pb-16 max-w-7xl mx-auto w-full flex flex-col items-center justify-center min-h-[60vh]">
          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 max-w-lg mx-auto text-center">
              <p className="mb-4">{error}</p>
              <button 
                onClick={() => navigate("/plan", { replace: true })}
                className="bg-[#2563EB] text-white px-4 py-2 rounded-lg font-semibold"
              >
                Go back to Plan
              </button>
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
