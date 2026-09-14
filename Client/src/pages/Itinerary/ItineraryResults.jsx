import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  Download,
  RotateCcw,
  Share2,
  CalendarPlus,
  Pencil,
  Ticket,
  Sunrise,
  Utensils,
  MapPin,
  Moon,
  Car,
  Plane,
  Bed,
  Activity
} from "lucide-react";
import ItineraryMap from "./ItineraryMap";
import { fetchFlightFarePrediction } from "../../lib/authApi";

function formatTime12Hour(timeStr) {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  if (!hours || isNaN(parseInt(hours, 10))) return timeStr;
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes || '00'} ${ampm}`;
}

function getActivityIcon(type, title) {
  const t = (type || "").toLowerCase();
  const ti = (title || "").toLowerCase();
  
  if (t === "wake up" || ti.includes("wake") || ti.includes("morning")) return <Sunrise size={16} className="text-orange-500" />;
  if (t === "breakfast" || t === "lunch" || t === "dinner" || t === "meal" || ti.includes("food") || ti.includes("eat")) return <Utensils size={16} className="text-red-500" />;
  if (ti.includes("evening") || ti.includes("night") || ti.includes("sleep")) return <Moon size={16} className="text-indigo-500" />;
  if (t === "transport" || ti.includes("drive") || ti.includes("taxi")) return <Car size={16} className="text-slate-500" />;
  if (ti.includes("flight") || ti.includes("fly") || ti.includes("airport")) return <Plane size={16} className="text-blue-500" />;
  if (ti.includes("hotel") || ti.includes("check-in") || ti.includes("rest")) return <Bed size={16} className="text-purple-500" />;
  if (t === "activity" || t === "sightseeing") return <MapPin size={16} className="text-emerald-500" />;
  
  return <Activity size={16} className="text-blue-400" />;
}

const CITY_AIRPORT_MAP = {
  goa: "Goa",
  calangute: "Goa",
  panjim: "Goa",
  anjuna: "Goa",
  palolem: "Goa",
  kerala: "Kochi",
  kerela: "Kochi",
  kochi: "Kochi",
  cochin: "Kochi",
  munnar: "Kochi",
  alleppey: "Kochi",
  varkala: "Kochi",
  thiruvananthapuram: "Thiruvananthapuram",
  rajasthan: "Jaipur",
  jaipur: "Jaipur",
  udaipur: "Udaipur",
  jodhpur: "Jodhpur",
  jaisalmer: "Jodhpur",
  kashmir: "Srinagar",
  srinagar: "Srinagar",
  gulmarg: "Srinagar",
  pahalgam: "Srinagar",
  sonamarg: "Srinagar",
  ladakh: "Leh",
  leh: "Leh",
  pangong: "Leh",
  nubra: "Leh",
  himachal: "Chandigarh",
  "himachal pradesh": "Chandigarh",
  shimla: "Chandigarh",
  manali: "Chandigarh",
  dharamshala: "Chandigarh",
  varanasi: "Varanasi",
  kashi: "Varanasi",
  lucknow: "Lucknow",
  meghalaya: "Guwahati",
  shillong: "Guwahati",
  cherrapunji: "Guwahati",
  guwahati: "Guwahati",
  delhi: "Delhi",
  "new delhi": "Delhi",
  mumbai: "Mumbai",
  bombay: "Mumbai",
  bengaluru: "Bengaluru",
  bangalore: "Bengaluru",
  kolkata: "Kolkata",
  hyderabad: "Hyderabad",
  chennai: "Chennai",
  pune: "Pune",
  ahmedabad: "Ahmedabad",
};

function resolveAirportCity(cityName, fallback = "Delhi") {
  if (!cityName) return fallback;
  const clean = String(cityName).trim().toLowerCase();
  for (const [key, val] of Object.entries(CITY_AIRPORT_MAP)) {
    if (clean.includes(key) || key.includes(clean)) {
      return val;
    }
  }
  return String(cityName).trim();
}

function getAirlineImage(airline) {
  const a = (airline || "").toLowerCase();
  if (a.includes("indigo")) return "/indigo.jpeg";
  if (a.includes("air india") || a.includes("vistara")) return "/airindia.jpeg";
  if (a.includes("spice")) return "/spicejet.jpeg";
  if (a.includes("akasa") || a.includes("alaska") || a.includes("star") || a.includes("trujet") || a.includes("flybig")) return "/alaskaair.jpeg";
  return "/indigo.jpeg";
}

function FlightPredictions({ itinerary }) {
  const location = useLocation();
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState({ origin: "Delhi", destination: "Goa" });
  const [error, setError] = useState("");

  useEffect(() => {
    const rawOrigin =
      location.state?.fromCity ||
      location.state?.origin ||
      itinerary?.origin ||
      itinerary?.fromCity ||
      itinerary?.userAnswers?.fromCity ||
      itinerary?.userAnswers?.origin ||
      (itinerary?.transport && itinerary?.transport[0]?.from) ||
      "Delhi";

    const rawDest = itinerary?.destination || "Goa";
    const sourceCity = resolveAirportCity(rawOrigin, "Delhi");
    const destCity = resolveAirportCity(rawDest, "Goa");
    const finalOrigin =
      sourceCity.toLowerCase() === destCity.toLowerCase()
        ? destCity.toLowerCase() === "delhi"
          ? "Mumbai"
          : "Delhi"
        : sourceCity;

    setRouteInfo({ origin: finalOrigin, destination: destCity });

    async function loadFlights() {
      setLoading(true);
      setError("");

      try {
        const startDateStr = itinerary?.startDate
          ? String(itinerary.startDate).substring(0, 10)
          : new Date().toISOString().substring(0, 10);

        const data = await fetchFlightFarePrediction({
          origin: finalOrigin,
          destination: destCity,
          startDate: startDateStr,
          windowDays: 7,
        });

        const quotes =
          data?.prediction?.results?.quotes ||
          data?.results?.quotes ||
          data?.quotes ||
          [];

        if (quotes.length > 0) {
          const formatted = quotes
            .map((q) => ({
              airline: q.airline || "IndiGo",
              flightNumber: q.flightNumber ?? q.flight_number ?? "601",
              date: q.date || "",
              dayOfWeek: q.dayOfWeek || q.day_of_week || "",
              predictedFare: Number(q.predictedFare ?? q.predicted_fare ?? 0),
              origin: finalOrigin,
              destination: destCity,
            }))
            .filter((q) => q.predictedFare > 0)
            .sort((a, b) => a.predictedFare - b.predictedFare)
            .slice(0, 3);

          setFlights(formatted);
        } else {
          setFlights([]);
        }
      } catch (err) {
        console.error("Flight ML microservice prediction error:", err);
        setError("Flight prediction is unavailable for this route.");
      } finally {
        setLoading(false);
      }
    }

    loadFlights();
  }, [itinerary, location.state]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-8 mt-6">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
          <span className="text-sm font-medium">
            Fetching ML flight fare predictions for {routeInfo.origin} → {routeInfo.destination}...
          </span>
        </div>
      </div>
    );
  }

  if (error || flights.length === 0) return null;

  return (
    <div className="mb-8 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-[#2563EB]" />
            <h2 className="text-xl font-bold text-slate-800">
              Flight Fare Predictions: {routeInfo.origin} → {routeInfo.destination}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Top 3 flight predictions powered by the ML flight fare microservice
          </p>
        </div>
        <div className="mt-2 sm:mt-0">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] border border-blue-100">
            Source: {routeInfo.origin} &bull; Dest: {routeInfo.destination}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {flights.map((flight, index) => {
          const airlineImg = getAirlineImage(flight.airline);
          const isBest = index === 0;

          return (
            <div
              key={index}
              className={`relative rounded-2xl border ${
                isBest ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"
              } overflow-hidden flex flex-row bg-white shadow-sm hover:shadow-md transition-all duration-200`}
            >
              {isBest && (
                <div className="absolute top-2 right-2 z-10">
                  <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    Best Fare
                  </span>
                </div>
              )}

              {/* Left Side: Flight Image */}
              <div className="w-2/5 min-w-[120px] max-w-[140px] bg-slate-50 p-2 flex flex-col items-center justify-center border-r border-slate-100">
                <img
                  src={airlineImg}
                  alt={flight.airline}
                  className="w-full h-24 object-contain rounded-lg"
                />
                <span className="text-[11px] font-bold text-slate-600 mt-1.5 text-center">
                  {flight.airline}
                </span>
              </div>

              {/* Right Side: Flight Info */}
              <div className="w-3/5 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <span className="text-slate-800">{flight.origin}</span>
                    <span>&rarr;</span>
                    <span className="text-slate-800">{flight.destination}</span>
                  </div>

                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                    Flight #{flight.flightNumber}
                  </p>

                  <div className="mt-1.5 inline-block bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded">
                    {flight.date} {flight.dayOfWeek ? `(${flight.dayOfWeek})` : ""}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Predicted Fare
                  </div>
                  <div className="text-lg font-extrabold text-[#2563EB]">
                    ₹{Math.round(flight.predictedFare).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (value) => `₹${safeNumber(value).toLocaleString("en-IN")}`;

function emptyActivity() {
  return { time: "09:00", type: "activity", title: "", description: "", cost: 0 };
}

export default function ItineraryResults({
  status,
  itinerary,
  error,
  readOnly = false,
  onDownloadPdf,
  onRegenerate,
  onPlanAnother,
  onSaveDays,
  savingDays = false,
  onShare,
  shareNotice = "",
  onBook,
  bookingBusy = false,
  booked = false,
  onExportIcs,
  loadingTitle = "Creating your itinerary...",
  loadingSubtitle = "This may take a minute while we plan every detail.",
}) {
  const [editingDay, setEditingDay] = useState(null);
  const [draftActivities, setDraftActivities] = useState([]);

  if (status === "loading") {
    return (
      <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-12 text-center max-w-md mx-auto">
        <Loader2 size={48} className="mx-auto mb-4 animate-spin text-[#2563EB]" />
        <h2 className="text-2xl font-bold mb-2">{loadingTitle}</h2>
        <p className="text-slate-500">{loadingSubtitle}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-start gap-2 max-w-3xl mx-auto">
        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
        <span>{error || "Failed to generate itinerary. Please try again."}</span>
      </div>
    );
  }

  if (status !== "ready" || !itinerary) return null;

  const budgetBreakdown = itinerary?.budgetBreakdown ?? {
    accommodation: 0,
    food: 0,
    transport: 0,
    activities: 0,
    miscellaneous: 0,
    total: 0,
    currency: "INR",
  };

  const accommodations = itinerary.accommodations || [];
  const placesToVisit = itinerary.placesToVisit || [];
  const days = itinerary.days || [];
  const tips = itinerary.tips || [];

  const startDayEdit = (day) => {
    setEditingDay(day.day);
    setDraftActivities((day.activities || []).map((activity) => ({ ...activity })));
  };

  const saveDayEdit = () => {
    if (!onSaveDays) return;
    const nextDays = days.map((day) =>
      day.day === editingDay
        ? { ...day, activities: draftActivities.filter((activity) => String(activity.title || "").trim()) }
        : day,
    );
    onSaveDays(nextDays);
    setEditingDay(null);
  };

  return (
    <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-8 mb-8">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
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

        <ItineraryMap destination={itinerary.destination} places={placesToVisit} />

        <h2 className="text-xl font-bold mt-6 mb-3">
          Budget Breakdown ({formatCurrency(budgetBreakdown?.total)})
        </h2>
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

        <FlightPredictions itinerary={itinerary} />

        <h2 className="text-xl font-bold mb-3">Accommodations</h2>
        <div className="space-y-3 mb-6">
          {accommodations.map((acc, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{acc.name}</p>
                <p className="text-sm text-slate-500">
                  {acc.type} · {acc.location} · ₹{Number(acc.pricePerNight || 0).toLocaleString()}/night
                </p>
              </div>
              <span className="text-[#2563EB] font-semibold">{acc.rating}★</span>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mb-3">Places to Visit</h2>
        <div className="space-y-3 mb-6">
          {placesToVisit.slice(0, 8).map((place, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{place.name}</p>
                <p className="text-sm text-slate-500">
                  {place.category} · {place.location} · {place.visitDurationHours}h
                </p>
              </div>
              <span className="text-[#2563EB] font-semibold">{place.rating}★</span>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mb-3">Day-by-Day Schedule</h2>
        <div className="space-y-4">
          {days.map((day) => (
            <div key={day.day} className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
                <span className="font-semibold text-[#133C55]">
                  Day {day.day} · {formatDate(day.date)}
                </span>
                <div className="flex items-center gap-2">
                  {day.theme && (
                    <span className="text-sm text-[#2563EB] bg-[#EBF3FE] px-2 py-1 rounded">{day.theme}</span>
                  )}
                  {!readOnly && onSaveDays && editingDay !== day.day && (
                    <button
                      type="button"
                      onClick={() => startDayEdit(day)}
                      className="text-xs font-semibold text-slate-500 hover:text-[#2563EB] inline-flex items-center gap-1"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  )}
                </div>
              </div>
              <div className="p-4 space-y-2">
                {editingDay === day.day ? (
                  <div className="space-y-3">
                    {draftActivities.map((activity, i) => (
                      <div key={i} className="grid gap-2 sm:grid-cols-12 items-start">
                        <input
                          value={activity.time || ""}
                          onChange={(e) => {
                            const next = [...draftActivities];
                            next[i] = { ...next[i], time: e.target.value };
                            setDraftActivities(next);
                          }}
                          className="sm:col-span-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          placeholder="09:00"
                        />
                        <input
                          value={activity.type || ""}
                          onChange={(e) => {
                            const next = [...draftActivities];
                            next[i] = { ...next[i], type: e.target.value };
                            setDraftActivities(next);
                          }}
                          className="sm:col-span-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          placeholder="type"
                        />
                        <input
                          value={activity.title || ""}
                          onChange={(e) => {
                            const next = [...draftActivities];
                            next[i] = { ...next[i], title: e.target.value };
                            setDraftActivities(next);
                          }}
                          className="sm:col-span-5 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          placeholder="Activity title"
                        />
                        <input
                          type="number"
                          min="0"
                          value={activity.cost || ""}
                          onChange={(e) => {
                            const next = [...draftActivities];
                            next[i] = { ...next[i], cost: Number(e.target.value) || 0 };
                            setDraftActivities(next);
                          }}
                          className="sm:col-span-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          placeholder="₹"
                        />
                        <button
                          type="button"
                          onClick={() => setDraftActivities(draftActivities.filter((_, idx) => idx !== i))}
                          className="sm:col-span-1 text-xs text-red-600 font-semibold"
                        >
                          Remove
                        </button>
                        <textarea
                          value={activity.description || ""}
                          onChange={(e) => {
                            const next = [...draftActivities];
                            next[i] = { ...next[i], description: e.target.value };
                            setDraftActivities(next);
                          }}
                          className="sm:col-span-12 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          rows={2}
                          placeholder="Notes"
                        />
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDraftActivities([...draftActivities, emptyActivity()])}
                        className="text-sm font-semibold text-[#2563EB]"
                      >
                        Add activity
                      </button>
                      <button
                        type="button"
                        onClick={saveDayEdit}
                        disabled={savingDays}
                        className="rounded-lg bg-[#2563EB] text-white text-sm font-semibold px-3 py-1.5 disabled:opacity-60"
                      >
                        {savingDays ? "Saving..." : "Save day"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDay(null)}
                        className="text-sm font-semibold text-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  (day.activities || []).map((activity, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm py-1 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2 w-28 flex-shrink-0">
                        {getActivityIcon(activity.type, activity.title)}
                        <span className="text-slate-500 font-medium whitespace-nowrap">{formatTime12Hour(activity.time)}</span>
                      </div>
                      <span className="rounded px-2 py-0.5 bg-[#EBF3FE] text-[#1D4ED8] text-xs font-medium capitalize">
                        {activity.type}
                      </span>
                      <span className="text-[#133C55]">{activity.title}</span>
                      {activity.description && <span className="text-slate-500">- {activity.description}</span>}
                      {activity.cost ? (
                        <span className="text-[#2563EB] font-semibold ml-auto">
                          ₹{activity.cost.toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mt-6 mb-3">Tips</h2>
        <ul className="space-y-2">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-600">
              <CheckCircle size={16} className="text-green-500 mt-1 flex-shrink-0" />
              {tip}
            </li>
          ))}
        </ul>

        {/* ── External Booking Links ── */}
        <BookingLinks destination={itinerary.destination} />
      </div>

      <div className="mt-8 flex gap-3 flex-wrap">
        {onDownloadPdf && (
          <button
            type="button"
            onClick={onDownloadPdf}
            className="flex-1 min-w-[160px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 transition-colors flex items-center justify-center gap-2"
          >
            <Download size={18} /> Download PDF
          </button>
        )}
        {onExportIcs && (
          <button
            type="button"
            onClick={onExportIcs}
            className="flex-1 min-w-[160px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 transition-colors flex items-center justify-center gap-2"
          >
            <CalendarPlus size={18} /> Add to calendar
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="flex-1 min-w-[160px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 transition-colors flex items-center justify-center gap-2"
          >
            <Share2 size={18} /> Copy share link
          </button>
        )}
        {onBook && (
          <button
            type="button"
            onClick={onBook}
            disabled={bookingBusy || booked}
            className="flex-1 min-w-[160px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-3 transition-colors flex items-center justify-center gap-2"
          >
            <Ticket size={18} /> {booked ? "Booked" : bookingBusy ? "Booking..." : "Book this plan"}
          </button>
        )}
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="flex-1 min-w-[160px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold py-3 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw size={18} /> Regenerate
          </button>
        )}
      </div>

      {shareNotice && <p className="mt-3 text-sm font-medium text-emerald-600">{shareNotice}</p>}

      {onPlanAnother && (
        <button
          type="button"
          onClick={onPlanAnother}
          className="mt-4 text-sm font-semibold text-slate-500 hover:text-[#2563EB] transition-colors"
        >
          Plan another trip
        </button>
      )}
    </div>
  );
}

// ── BookingLinks ──────────────────────────────────────────────────────────────
// Provides external redirect links to official travel booking platforms.
// Tripzy does NOT handle payments - it redirects to the platform's own site.

const BOOKING_PLATFORMS = [
  {
    category: "✈️ Flights",
    links: [
      { name: "MakeMyTrip", color: "#E63946", getUrl: () => "https://www.makemytrip.com/flights/" },
      { name: "IndiGo", color: "#13599A", getUrl: () => "https://www.goindigo.in/" },
      { name: "Air India", color: "#C8102E", getUrl: () => "https://www.airindia.com/" },
      { name: "EaseMyTrip", color: "#FF6D00", getUrl: () => "https://flight.easemytrip.com/" },
    ],
  },
  {
    category: "🚆 Trains",
    links: [
      { name: "IRCTC", color: "#1A4B8C", getUrl: () => "https://www.irctc.co.in/" },
      { name: "RailYatri", color: "#E54B4B", getUrl: () => "https://www.railyatri.in/" },
    ],
  },
  {
    category: "🚌 Buses",
    links: [
      { name: "RedBus", color: "#D84E43", getUrl: () => "https://www.redbus.in/" },
      { name: "AbhiBus", color: "#2E7D32", getUrl: () => "https://www.abhibus.com/" },
    ],
  },
];

function BookingLinks({ destination: _destination }) {
  return (
    <div className="mt-8 mb-2">
      <h2 className="text-xl font-bold mb-1">Book Your Trip</h2>
      <p className="text-sm text-slate-500 mb-4">
        We&apos;ll redirect you to official platforms. Tripzy does not handle payments or reservations.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {BOOKING_PLATFORMS.map((group) => (
          <div key={group.category} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-sm text-slate-700 mb-3">{group.category}</p>
            <div className="flex flex-col gap-2">
              {group.links.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.getUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: platform.color }}
                >
                  {platform.name}
                  <span className="ml-auto text-xs opacity-80">↗</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
