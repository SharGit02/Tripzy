import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Loader2, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp, Download, RotateCcw } from "lucide-react";
import UserNavbar from "../../components/layout/UserNavbar";
import { generateItinerary, fetchItineraries, fetchItineraryById, downloadItineraryPdf, regenerateItinerary, updateItinerary, deleteItinerary, request } from "../../lib/authApi";

const INITIAL_ITINERARY_STATE = { status: "idle", itinerary: null, error: "" };

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

const safeNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (value) => {
    return `₹${safeNumber(value).toLocaleString("en-IN")}`;
};

export default function ItineraryPlannerPage() {
  const navigate = useNavigate();
  const [itineraryState, setItineraryState] = useState(INITIAL_ITINERARY_STATE);
  const [isGenerating, setIsGenerating] = useState(false);

const handleGenerateItinerary = useCallback(
  async (e) => {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData(form);

    const destination = String(formData.get("destination") || "").trim();
    const startDate = String(formData.get("startDate") || "");
    const endDate = String(formData.get("endDate") || "");

    if (!destination || !startDate || !endDate) {
      setItineraryState({
        status: "error",
        itinerary: null,
        error: "Destination, start date, and end date are required",
      });
      return;
    }

    const payload = {
      destination,
      startDate,
      endDate,
      adults: Number(formData.get("adults")) || 2,
      children: Number(formData.get("children")) || 0,
      rooms: Number(formData.get("rooms")) || 1,
      accommodationType:
        String(formData.get("accommodationType") || "standard"),
      preferredTransport:
        String(formData.get("preferredTransport") || "flight"),
      tripType: String(formData.get("tripType") || "couple"),
      interests: formData.getAll("interests"),
      wheelchairAccessible:
        formData.get("wheelchairAccessible") === "on",
      travelStyle: String(formData.get("travelStyle") || "balanced"),
      specialRequests:
        String(formData.get("specialRequests") || "").trim(),
      budget: formData.get("budget")
        ? Number(formData.get("budget"))
        : undefined,
    };

    setItineraryState({
      status: "loading",
      itinerary: null,
      error: "",
    });
    setIsGenerating(true);

    try {
      const data = await generateItinerary(payload);

      if (!data?.itinerary) {
        throw new Error("No itinerary was returned by the server.");
      }

setItineraryState({
      status: "ready",
      itinerary: data.itinerary,
      itineraryId: data.itineraryId,
      error: "",
    });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to generate itinerary. Please try again.";

      setItineraryState({
        status: "error",
        itinerary: null,
        error: message,
      });
    } finally {
      setIsGenerating(false);
    }
  },
  [generateItinerary]
);

  const handleRegenerate = useCallback(async (modifications) => {
    if (!itineraryState.itinerary) return;

    setItineraryState({ status: "loading", itinerary: itineraryState.itinerary, error: "" });

    try {
      const data = await regenerateItinerary(itineraryState.itinerary.id, modifications);
      setItineraryState({ status: "ready", itinerary: data.itinerary, error: "" });
    } catch (err) {
      setItineraryState({ status: "error", itinerary: itineraryState.itinerary, error: err.message });
    }
  }, [itineraryState.itinerary]);

  const handleDownloadPdf = useCallback(async () => {
    try {
      const itin = itineraryState.itinerary;
      const id = itineraryState.itineraryId;

      if (!id) {
        console.error("Missing itinerary ID");
        alert("Itinerary ID not available. Please generate the itinerary again.");
        return;
      }

      const response = await downloadItineraryPdf(id);

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${itin.destination.replace(/\s+/g, "-")}-itinerary.pdf`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download error:", err);

      alert(
        "Failed to download PDF: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  }, [itineraryState.itinerary, itineraryState.itineraryId]);

  // Render form
  if (itineraryState.status === "idle" || itineraryState.status === "error") {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#133C55]">
        <UserNavbar />
        <main className="pt-28 px-6 pb-16 max-w-3xl mx-auto">
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#2563EB] transition-colors mb-4"
          >
            <ArrowLeft size={15} /> Back to dashboard
          </button>

          <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-8">
            <h1 className="text-3xl font-extrabold mb-2">Plan Your Trip</h1>
            <p className="text-[#386FA4] mb-6">Fill in your trip details and we'll create a personalized itinerary for you.</p>

            <form onSubmit={handleGenerateItinerary} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#0f2442] mb-1">Destination</label>
                <input
                  name="destination"
                  type="text"
                  placeholder="e.g., Goa, Kerala, Rajasthan"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#133C55] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0f2442] mb-1">Start Date</label>
                  <input
                    name="startDate"
                    type="date"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#133C55] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0f2442] mb-1">End Date</label>
                  <input
                    name="endDate"
                    type="date"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#133C55] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0f2442] mb-1">Adults</label>
                  <input
                    name="adults"
                    type="number"
                    min="1"
                    max="10"
                    defaultValue="2"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#133C55] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0f2442] mb-1">Children</label>
                  <input
                    name="children"
                    type="number"
                    min="0"
                    max="10"
                    defaultValue="0"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#133C55] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0f2442] mb-1">Rooms</label>
                  <input
                    name="rooms"
                    type="number"
                    min="1"
                    max="10"
                    defaultValue="1"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#133C55] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0f2442] mb-1">Budget (₹)</label>
                  <input
                    name="budget"
                    type="number"
                    min="1000"
                    placeholder="Optional"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#133C55] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0f2442] mb-1">Accommodation Type</label>
                <select
                  name="accommodationType"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#133C55] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  defaultValue="standard"
                >
                  <option value="budget">Budget (₹1,000-3,000/night)</option>
                  <option value="standard">Standard (₹3,000-7,000/night)</option>
                  <option value="premium">Premium (₹7,000-15,000/night)</option>
                  <option value="luxury">Luxury (₹15,000+/night)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0f2442] mb-1">Preferred Transport</label>
                <select
                  name="preferredTransport"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#133C55] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  defaultValue="flight"
                >
                  <option value="flight">Flight</option>
                  <option value="train">Train</option>
                  <option value="bus">Bus</option>
                  <option value="self_drive">Self Drive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0f2442] mb-1">Trip Type</label>
                <select
                  name="tripType"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#133C55] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  defaultValue="couple"
                >
                  <option value="solo">Solo</option>
                  <option value="couple">Couple</option>
                  <option value="family">Family</option>
                  <option value="friends">Friends</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0f2442] mb-1">Interests</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {["nature", "adventure", "beaches", "spiritual", "shopping", "food", "wildlife", "history"].map((interest) => (
                    <label key={interest} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        name="interests"
                        value={interest}
                        className="w-4 h-4 text-[#2563EB] border-slate-300 rounded focus:ring-2 focus:ring-[#2563EB]"
                      />
                      <span className="capitalize text-[#133C55]">{interest}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="wheelchairAccessible"
                  id="wheelchairAccessible"
                  className="w-4 h-4 text-[#2563EB] border-slate-300 rounded focus:ring-2 focus:ring-[#2563EB]"
                />
                <label htmlFor="wheelchairAccessible" className="text-sm text-[#133C55]">Wheelchair accessible</label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0f2442] mb-1">Travel Style</label>
                <select
                  name="travelStyle"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#133C55] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  defaultValue="balanced"
                >
                  <option value="relaxed">Relaxed</option>
                  <option value="balanced">Balanced</option>
                  <option value="packed">Packed</option>
                  <option value="adventure">Adventure</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0f2442] mb-1">Special Requests (optional)</label>
                <textarea
                  name="specialRequests"
                  rows={3}
                  placeholder="Any special requirements, dietary restrictions, occasions, etc."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[#133C55] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                />
              </div>

<div>{itineraryState.status === "error" && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle size={16} /> {itineraryState.error}
                  </div>
                )}</div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating && <Loader2 size={18} className="animate-spin" />}
                {isGenerating ? "Creating your itinerary..." : "Generate Itinerary"}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // Generating state
  if (itineraryState.status === "loading") {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#133C55] flex items-center justify-center">
        <UserNavbar />
        <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-12 text-center max-w-md mx-auto">
          <Loader2 size={48} className="mx-auto mb-4 animate-spin text-[#2563EB]" />
          <h2 className="text-2xl font-bold mb-2">Creating your itinerary...</h2>
          <p className="text-slate-500">This may take a minute while we plan every detail.</p>
        </div>
      </div>
    );
  }

  // Result state
  if (itineraryState.status === "ready" && itineraryState.itinerary) {
    const itinerary = itineraryState.itinerary;
    const budgetBreakdown = itinerary?.budgetBreakdown ?? {
    accommodation: 0,
    food: 0,
    transport: 0,
    activities: 0,
    miscellaneous: 0,
    total: 0,
    currency: "INR",
  };

    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#133C55]">
        <UserNavbar />
        <main className="pt-28 px-6 pb-16 max-w-5xl mx-auto">
          <button
            onClick={() => setItineraryState({ status: "idle", itinerary: null, error: "" })}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#2563EB] transition-colors mb-4"
          >
            <ArrowLeft size={15} /> Plan another trip
          </button>

          <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-8 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-extrabold">{itinerary.destination} Itinerary</h1>
                <p className="text-[#386FA4]">
                  {formatDate(itinerary.startDate)} - {formatDate(itinerary.endDate)} · {itinerary.totalDays} days
                </p>
              </div>
              <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-sm font-semibold">
                Ready
              </span>
            </div>

            <div className="prose prose-slate max-w-none">
              <h2 className="text-xl font-bold mb-3">Overview</h2>
              <p className="text-slate-600">{itinerary.overview}</p>

              <h2 className="text-xl font-bold mt-6 mb-3">Budget Breakdown (₹{formatCurrency(budgetBreakdown?.total)})</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {[
                  { key: "accommodation", label: "Stay" },
                  { key: "food", label: "Food" },
                  { key: "transport", label: "Transport" },
                  { key: "activities", label: "Activities" },
                  { key: "miscellaneous", label: "Other" },
                ].map(({ key, label }) => (
                  <div key={key} className="rounded-xl bg-slate-50 p-4 text-center">
                    <p className="text-2xl font-bold text-[#2563EB]">{formatCurrency(budgetBreakdown?.[key])}</p>
                    <p className="text-sm text-slate-500">{label}</p>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-bold mb-3">Accommodations</h2>
              <div className="space-y-3 mb-6">
                {itinerary.accommodations.map((acc, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{acc.name}</p>
                      <p className="text-sm text-slate-500">{acc.type} · {acc.location} · ₹{acc.pricePerNight.toLocaleString()}/night</p>
                    </div>
                    <span className="text-[#2563EB] font-semibold">{acc.rating}★</span>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-bold mb-3">Places to Visit</h2>
              <div className="space-y-3 mb-6">
                {itinerary.placesToVisit.slice(0, 8).map((place, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{place.name}</p>
                      <p className="text-sm text-slate-500">{place.category} · {place.location} · {place.visitDurationHours}h</p>
                    </div>
                    <span className="text-[#2563EB] font-semibold">{place.rating}★</span>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-bold mb-3">Day-by-Day Schedule</h2>
              <div className="space-y-4">
                {itinerary.days.map((day) => (
                  <div key={day.day} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <span className="font-semibold text-[#133C55]">Day {day.day} · {formatDate(day.date)}</span>
                      {day.theme && <span className="text-sm text-[#2563EB] bg-[#EBF3FE] px-2 py-1 rounded">{day.theme}</span>}
                    </div>
                    <div className="p-4 space-y-2">
                      {day.activities.map((activity, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm">
                          <span className="w-16 text-slate-500 font-mono">{activity.time}</span>
                          <span className="rounded px-2 py-0.5 bg-[#EBF3FE] text-[#1D4ED8] text-xs font-medium capitalize">{activity.type}</span>
                          <span className="text-[#133C55]">{activity.title}</span>
                          {activity.description && <span className="text-slate-500">- {activity.description}</span>}
                          {activity.cost && <span className="text-[#2563EB] font-semibold ml-auto">₹{activity.cost.toLocaleString()}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-bold mt-6 mb-3">Tips</h2>
              <ul className="space-y-2">
                {itinerary.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-600">
                    <CheckCircle size={16} className="text-green-500 mt-1 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={handleDownloadPdf}
                className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 transition-colors flex items-center justify-center gap-2"
              >
                <Download size={18} /> Download PDF
              </button>
              <button
                onClick={() => {
                  setItineraryState({ status: "loading", itinerary: itineraryState.itinerary, error: "" });
                  regenerateItinerary(prompt("What changes would you like?"));
                }}
                className="flex-1 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold py-3 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} /> Regenerate
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}