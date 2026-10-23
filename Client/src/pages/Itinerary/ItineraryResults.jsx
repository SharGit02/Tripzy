import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Sunrise,
  Utensils,
  MapPin,
  Moon,
  Car,
  Plane,
  TrainFront,
  Bus,
  Bed,
  Activity,
  Mail,
  Star,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sun,
  Cloud,
  Cloudy,
  CloudSun,
  CloudMoon,
  CloudDrizzle,
  CloudSunRain,
  CloudMoonRain,
  CloudLightning,
  CloudSnow,
  CloudFog
} from "lucide-react";
import ItineraryMap from "./ItineraryMap";
import {
  fetchFlightFarePrediction,
  fetchRailFarePrediction,
  fetchBusFarePrediction,
  saveItinerarySelections,
} from "../../lib/authApi";
import { safeHttpUrl } from "../../lib/safeUrl";
import PlaceTicketCard from "../../components/itinerary/PlaceTicketCard";
import PriceHistoryGraph from "../../components/itinerary/PriceHistoryGraph";
import TicketContainer from "../../components/itinerary/TicketContainer";

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
  if (a.includes("indigo")) return "/flight-planes-image/indigo.jpeg";
  if (a.includes("air india") || a.includes("vistara")) return "/flight-planes-image/airindia.jpeg";
  if (a.includes("spice")) return "/flight-planes-image/spicejet.jpeg";
  if (a.includes("akasa") || a.includes("alaska") || a.includes("star") || a.includes("trujet") || a.includes("flybig")) return "/flight-planes-image/alaskaair.jpeg";
  return "/flight-planes-image/indigo.jpeg";
}

function getAirlineLogo(airline) {
  const a = (airline || "").toLowerCase();
  if (a.includes("indigo")) return "/flights-brand-name-svg/IndiGo-Logo-1.svg";
  if (a.includes("air india") || a.includes("vistara")) return "/flights-brand-name-svg/Air-India-Logo-3.svg";
  if (a.includes("spice")) return "/flights-brand-name-svg/SpiceJet-Logo-SVG_005.svg";
  if (a.includes("akasa") || a.includes("alaska") || a.includes("star") || a.includes("trujet") || a.includes("flybig")) return "/flights-brand-name-svg/Alaska-Airlines-Logo.svg";
  return "/flights-brand-name-svg/IndiGo-Logo-1.svg";
}

function getAirlineAccent(airline) {
  const a = (airline || "").toLowerCase();
  if (a.includes("indigo")) return { from: "#1a237e", to: "#283593" };
  if (a.includes("air india") || a.includes("vistara")) return { from: "#8b0000", to: "#b71c1c" };
  if (a.includes("spice")) return { from: "#b71c1c", to: "#c62828" };
  return { from: "#1565c0", to: "#1976d2" };
}

function getFallbackFlights(origin, destination, dateStr) {
  const d = new Date(dateStr || Date.now());
  const dayName = d.toLocaleDateString("en-US", { weekday: "long" }) || "Friday";
  const formattedDate = dateStr ? dateStr.substring(0, 10) : new Date().toISOString().substring(0, 10);
  return [
    {
      airline: "IndiGo",
      flightNumber: "6E 614",
      date: formattedDate,
      dayOfWeek: dayName,
      predictedFare: 4850,
      origin,
      destination,
    },
    {
      airline: "Air India",
      flightNumber: "AI 804",
      date: formattedDate,
      dayOfWeek: dayName,
      predictedFare: 5620,
      origin,
      destination,
    },
    {
      airline: "SpiceJet",
      flightNumber: "SG 231",
      date: formattedDate,
      dayOfWeek: dayName,
      predictedFare: 4490,
      origin,
      destination,
    },
  ];
}

function FlightPredictions({ itinerary, source, date, direction = "outbound", isFlightSelected, onToggleFlight, selectable }) {
  const location = useLocation();
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState({ origin: "Delhi", destination: "Goa" });

  useEffect(() => {
    const rawOrigin =
      source ||
      location.state?.fromCity ||
      location.state?.origin ||
      itinerary?.origin ||
      itinerary?.fromCity ||
      itinerary?.userAnswers?.fromCity ||
      itinerary?.userAnswers?.origin ||
      (itinerary?.transport && itinerary?.transport[0]?.from) ||
      "Delhi";

    const rawDest = itinerary?.destination || "Goa";
    let sourceCity = resolveAirportCity(rawOrigin, "Delhi");
    let destCity = resolveAirportCity(rawDest, "Goa");
    if (sourceCity.toLowerCase() === destCity.toLowerCase()) {
      sourceCity = destCity.toLowerCase() === "delhi" ? "Mumbai" : "Delhi";
    }
    // The return leg flies the route backwards: destination becomes the
    // departure point, the original source city is home.
    const finalOrigin = direction === "return" ? destCity : sourceCity;
    const finalDest = direction === "return" ? sourceCity : destCity;

    setRouteInfo({ origin: finalOrigin, destination: finalDest });

    async function loadFlights() {
      setLoading(true);

      const startDateStr = date
        ? String(date).substring(0, 10)
        : itinerary?.startDate
        ? String(itinerary.startDate).substring(0, 10)
        : new Date().toISOString().substring(0, 10);

      try {
        const data = await fetchFlightFarePrediction({
          origin: finalOrigin,
          destination: finalDest,
          startDate: startDateStr,
          // Exactly the travel date, not a week-wide window: the traveler
          // asked for the card's date to match the going/return date, not
          // "somewhere in the next week".
          windowDays: 1,
        });

        const quotes =
          data?.prediction?.results?.quotes ||
          data?.results?.quotes ||
          data?.quotes ||
          [];

        if (quotes.length > 0) {
          const sortedQuotes = quotes
            .map((q) => ({
              airline: q.airline || "IndiGo",
              flightNumber: q.flightNumber ?? q.flight_number ?? "601",
              date: q.date || startDateStr,
              dayOfWeek: q.dayOfWeek || q.day_of_week || "",
              predictedFare: Number(q.predictedFare ?? q.predicted_fare ?? 0),
              origin: finalOrigin,
              destination: finalDest,
            }))
            .filter((q) => q.predictedFare > 0)
            .sort((a, b) => a.predictedFare - b.predictedFare);

          const diverseFlights = [];
          const seenAirlines = new Set();

          // Pass 1: Get the cheapest flight for each distinct airline
          for (const q of sortedQuotes) {
            if (!seenAirlines.has(q.airline)) {
              seenAirlines.add(q.airline);
              diverseFlights.push(q);
            }
            if (diverseFlights.length >= 3) break;
          }

          // Pass 2: If fewer than 3 unique airlines exist, fill remaining slots
          if (diverseFlights.length < 3) {
            for (const q of sortedQuotes) {
              if (diverseFlights.length >= 3) break;
              const alreadyAdded = diverseFlights.some(
                (f) => f.flightNumber === q.flightNumber && f.airline === q.airline && f.date === q.date
              );
              if (!alreadyAdded) {
                diverseFlights.push(q);
              }
            }
          }

          // Final sort to ensure the 3 items are strictly in price order
          diverseFlights.sort((a, b) => a.predictedFare - b.predictedFare);

          setFlights(diverseFlights);
        } else {
          setFlights(getFallbackFlights(finalOrigin, finalDest, startDateStr));
        }
      } catch (err) {
        console.warn("Using fallback flight fare predictions:", err);
        setFlights(getFallbackFlights(finalOrigin, finalDest, startDateStr));
      } finally {
        setLoading(false);
      }
    }

    loadFlights();
  }, [itinerary, source, date, direction, location.state]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-8 mt-6">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
          <span className="text-sm font-medium">
            Fetching flight fare predictions for {routeInfo.origin} → {routeInfo.destination}...
          </span>
        </div>
      </div>
    );
  }

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
            {selectable
              ? "Tick the flight you want and it will be included in your PDF"
              : "Top 3 flight predictions powered by the ML flight fare microservice"}
          </p>
        </div>
        <div className="mt-2 sm:mt-0">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] border border-blue-100">
            Source: {routeInfo.origin} &bull; Dest: {routeInfo.destination}
          </span>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {flights.map((flight, index) => {
          const airlineImg = getAirlineImage(flight.airline);
          const airlineLogo = getAirlineLogo(flight.airline);
          const accent = getAirlineAccent(flight.airline);
          const isBest = index === 0;
          const chosen = selectable && isFlightSelected?.(flight, direction);

          return (
            <div
              key={index}
              className={`relative rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 ${
                chosen
                  ? "ring-2 ring-[#2563EB] ring-offset-2"
                  : isBest
                  ? "ring-2 ring-blue-400 ring-offset-2"
                  : "border border-slate-200"
              }`}
            >
              {/* Best fare badge */}
              {isBest && (
                <div className="absolute top-3 left-3 z-20">
                  <span className="bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md tracking-wide">
                    ✦ BEST FARE
                  </span>
                </div>
              )}

              {selectable && (
                <label className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 shadow-md cursor-pointer">
                  <SelectBox
                    checked={Boolean(chosen)}
                    onChange={() => onToggleFlight?.(flight, direction)}
                    label={`Choose the ${flight.airline} flight ${flight.flightNumber} for this leg`}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    {chosen ? "Chosen" : "Choose"}
                  </span>
                </label>
              )}

              {/* Hero: Plane photo — cropped to landscape banner */}
              <div className="relative h-40 overflow-hidden">
                <img
                  src={airlineImg}
                  alt={`${flight.airline} aircraft`}
                  className="w-full h-full object-cover object-center"
                  style={{ objectPosition: "center 60%" }}
                />
                {/* Gradient overlay so bottom text is readable */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(to top, ${accent.from}ee 0%, ${accent.from}55 50%, transparent 100%)`
                  }}
                />

                {/* Brand SVG logo — pinned bottom-left over gradient */}
                <div className="absolute bottom-2.5 left-3 z-10 w-24 h-8 flex items-center justify-start">
                    <img
                      src={airlineLogo}
                      alt={flight.airline}
                      className="max-h-full max-w-full object-contain"
                    />
                </div>

                {/* Flight number — pinned bottom-right */}
                <div className="absolute bottom-3 right-3 z-10">
                  <span
                    className="text-white text-[11px] font-bold tracking-wider px-2 py-0.5 rounded"
                    style={{ background: "rgba(0,0,0,0.7)" }}
                  >
                    Flight: {flight.flightNumber}
                  </span>
                </div>
              </div>

              {/* Details panel */}
              <div className="px-4 pt-3 pb-4">
                {/* Route */}
                <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-1">
                  <span>{flight.origin}</span>
                  <span className="text-[#2563EB] text-base">✈</span>
                  <span>{flight.destination}</span>
                </div>

                {/* Date */}
                <p className="text-[11px] text-slate-500 font-medium">
                  {flight.date}{flight.dayOfWeek ? ` · ${flight.dayOfWeek}` : ""}
                </p>

                {/* Divider */}
                <div className="my-3 border-t border-dashed border-slate-200" />

                {/* Fare row */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-0.5">Predicted Fare</p>
                    <p className="text-2xl font-extrabold" style={{ color: accent.from }}>
                      ₹{Math.round(flight.predictedFare).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 italic">AI estimate</p>
                    <p className="text-[10px] text-slate-400">fares may vary</p>
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


/* ── Rail ────────────────────────────────────────────────────────────────────
 * The rail model (lightgbm_rail_model_3_inputs.pkl) predicts a fare from three
 * inputs only: origin station, destination station, journey date. It knows
 * nothing about individual trains, so a card is a DATE, not a service — there
 * is no train name, number, class or timing to show, and inventing one would
 * present a guess as a quote.
 *
 * No train identity means no real livery to key a specific photo on, so the
 * photos in public/train-images are DECORATIVE: picked deterministically per
 * card (stable across re-renders, varied across the cards shown), never
 * presented as the train that actually runs that day. Nothing on the card
 * names a service, so an arbitrary livery claims nothing. If a train listing
 * ever lands, key the filename off its service name instead.
 */
const GENERIC_RAIL_IMAGES = [
  "/train-images/vandebharat.jpeg",
  "/train-images/rajdhani.jpeg",
  "/train-images/shatabdi.jpeg",
  "/train-images/Humsafar.jpeg",
  "/train-images/Duronto.jpeg",
  "/train-images/Garib%20Rath.jpeg",
  "/train-images/Express%20Blue.jpeg",
  "/train-images/Passenger.jpeg",
  "/train-images/toytrain.jpeg",
  "/train-images/image3.jpg",
  "/train-images/images.jpeg",
  "/train-images/images2.jpeg",
];

function railImageFor(quote) {
  const hash = `${quote?.date || ""}${quote?.predictedFare || ""}`
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return GENERIC_RAIL_IMAGES[hash % GENERIC_RAIL_IMAGES.length];
}

function RailCard({ quote, index, selectable, chosen, onToggle }) {
  const imageSrc = railImageFor(quote);
  const [imgFailed, setImgFailed] = useState(false);
  const alt = `Indian Railways train from ${quote.origin} to ${quote.destination}`;
  const isBest = index === 0;

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 ${
        chosen
          ? "ring-2 ring-[#2563EB] ring-offset-2"
          : isBest
          ? "ring-2 ring-emerald-400 ring-offset-2"
          : "border border-slate-200"
      }`}
    >
      {isBest && (
        <div className="absolute top-3 left-3 z-20">
          <span className="bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md tracking-wide">
            ✦ BEST FARE
          </span>
        </div>
      )}

      {selectable && (
        <label className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 shadow-md cursor-pointer">
          <SelectBox
            checked={Boolean(chosen)}
            onChange={() => onToggle?.(quote)}
            label={`Choose the ${quote.date} train from ${quote.origin} to ${quote.destination} for this leg`}
          />
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
            {chosen ? "Chosen" : "Choose"}
          </span>
        </label>
      )}

      {/* Decorative photo; falls back to a labelled icon if the file is missing. */}
      <div className="relative h-40 overflow-hidden bg-slate-100">
        {!imgFailed ? (
          <img
            src={imageSrc}
            alt={alt}
            loading="lazy"
            className="w-full h-full object-cover object-center"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            role="img"
            aria-label={alt}
            className="w-full h-full flex items-center justify-center text-slate-300"
          >
            <TrainFront size={44} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-1">
          <span className="truncate">{quote.origin}</span>
          <span className="text-[#2563EB] text-base">→</span>
          <span className="truncate">{quote.destination}</span>
        </div>

        <p className="text-[11px] text-slate-500 font-medium">
          {quote.date}{quote.dayOfWeek ? ` · ${quote.dayOfWeek}` : ""}
        </p>

        <div className="my-3 border-t border-dashed border-slate-200" />

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-0.5">
              Predicted Fare
            </p>
            <p className="text-2xl font-extrabold text-[#0f2442]">
              ₹{Math.round(quote.predictedFare).toLocaleString("en-IN")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 italic">AI estimate</p>
            <p className="text-[10px] text-slate-400">fares may vary</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RailPredictions({ itinerary, source, date, direction = "outbound", isTrainSelected, onToggleTrain, selectable }) {
  const [state, setState] = useState({ status: "loading", quotes: [], error: "" });

  const sourceCity = source || "Delhi";
  const destCity = itinerary?.destination || "";
  // The return leg rides the route backwards, same as flights.
  const origin = direction === "return" ? destCity : sourceCity;
  const destination = direction === "return" ? sourceCity : destCity;
  const startDate = date
    ? String(date).substring(0, 10)
    : itinerary?.startDate
    ? String(itinerary.startDate).substring(0, 10)
    : new Date().toISOString().substring(0, 10);

  useEffect(() => {
    if (!destination) return undefined;
    let cancelled = false;
    setState({ status: "loading", quotes: [], error: "" });

    // Exactly the travel date, not a week-wide window: the rail model has no
    // per-train identity, so this is one predicted fare for that one date.
    fetchRailFarePrediction({ origin, destination, startDate, windowDays: 1 })
      .then((data) => {
        if (cancelled) return;
        const prediction = data?.prediction;
        const quotes = (prediction?.quotes || []).map((quote) => ({
          origin: prediction.origin,
          destination: prediction.destination,
          date: quote.date,
          dayOfWeek: quote.dayOfWeek,
          predictedFare: Number(quote.predictedFare),
        }));
        setState({ status: "ready", quotes, error: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          quotes: [],
          error: error?.message || "Train fares are unavailable for this route.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [origin, destination, startDate]);

  if (!destination) return null;

  return (
    <div className="mb-8 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <TrainFront className="w-5 h-5 text-[#2563EB]" />
            <h2 className="text-xl font-bold text-slate-800">
              Train Fare: {origin} → {destination}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {selectable ? "Choose this to travel by train for this leg" : `Predicted fare for ${startDate}`}
          </p>
        </div>
      </div>

      {state.status === "loading" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center gap-3 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
          <span className="text-sm font-medium">
            Fetching train fare predictions for {origin} → {destination}...
          </span>
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          {state.error}
        </div>
      )}

      {state.status === "ready" && state.quotes.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          No train fares were predicted for this route.
        </div>
      )}

      {state.status === "ready" && state.quotes.length > 0 && (
        <div className="grid gap-5 md:grid-cols-3">
          {state.quotes.map((quote, index) => (
            <RailCard
              key={`${quote.date}-${quote.predictedFare}`}
              quote={quote}
              index={index}
              selectable={selectable}
              chosen={selectable && isTrainSelected?.(quote, direction)}
              onToggle={(q) => onToggleTrain?.(q, direction)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Bus ─────────────────────────────────────────────────────────────────────
 * Served by random_forest_bus_model.pkl via /api/bus-fare/predict. Same shape
 * as rail: no operator/service identity, a card is a DATE not a service, and
 * an unrecognised city degrades to a generic estimate rather than erroring
 * (see bus_predictor.py) — so this, unlike rail, never shows an error card
 * for an unknown city, only for a genuinely unreachable ML service.
 */
const GENERIC_BUS_IMAGES = ["/bus-images/bus1.jpg", "/bus-images/bus2.jpg", "/bus-images/bus3.jpg"];

function busImageFor(quote) {
  const hash = `${quote?.date || ""}${quote?.predictedFare || ""}`
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return GENERIC_BUS_IMAGES[hash % GENERIC_BUS_IMAGES.length];
}

function BusCard({ quote, index, selectable, chosen, onToggle }) {
  const imageSrc = busImageFor(quote);
  const [imgFailed, setImgFailed] = useState(false);
  const alt = `Intercity bus from ${quote.origin} to ${quote.destination}`;
  const isBest = index === 0;

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 ${
        chosen
          ? "ring-2 ring-[#2563EB] ring-offset-2"
          : isBest
          ? "ring-2 ring-amber-400 ring-offset-2"
          : "border border-slate-200"
      }`}
    >
      {isBest && (
        <div className="absolute top-3 left-3 z-20">
          <span className="bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md tracking-wide">
            ✦ BEST FARE
          </span>
        </div>
      )}

      {selectable && (
        <label className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 shadow-md cursor-pointer">
          <SelectBox
            checked={Boolean(chosen)}
            onChange={() => onToggle?.(quote)}
            label={`Choose the ${quote.date} bus from ${quote.origin} to ${quote.destination} for this leg`}
          />
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
            {chosen ? "Chosen" : "Choose"}
          </span>
        </label>
      )}

      <div className="relative h-40 overflow-hidden bg-slate-100">
        {!imgFailed ? (
          <img
            src={imageSrc}
            alt={alt}
            loading="lazy"
            className="w-full h-full object-cover object-center"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div role="img" aria-label={alt} className="w-full h-full flex items-center justify-center text-slate-300">
            <Bus size={44} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-1">
          <span className="truncate">{quote.origin}</span>
          <span className="text-[#2563EB] text-base">→</span>
          <span className="truncate">{quote.destination}</span>
        </div>

        <p className="text-[11px] text-slate-500 font-medium">
          {quote.date}
          {quote.dayOfWeek ? ` · ${quote.dayOfWeek}` : ""}
        </p>

        <div className="my-3 border-t border-dashed border-slate-200" />

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-0.5">Predicted Fare</p>
            <p className="text-2xl font-extrabold text-amber-600">
              ₹{Math.round(quote.predictedFare).toLocaleString("en-IN")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 italic">AI estimate</p>
            <p className="text-[10px] text-slate-400">fares may vary</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BusPredictions({ itinerary, source, date, direction = "outbound", isBusSelected, onToggleBus, selectable }) {
  const [state, setState] = useState({ status: "loading", quotes: [], error: "" });

  const sourceCity = source || "Delhi";
  const destCity = itinerary?.destination || "";
  const origin = direction === "return" ? destCity : sourceCity;
  const destination = direction === "return" ? sourceCity : destCity;
  const startDate = date
    ? String(date).substring(0, 10)
    : itinerary?.startDate
    ? String(itinerary.startDate).substring(0, 10)
    : new Date().toISOString().substring(0, 10);

  useEffect(() => {
    if (!destination) return undefined;
    let cancelled = false;
    setState({ status: "loading", quotes: [], error: "" });

    fetchBusFarePrediction({ origin, destination, startDate, windowDays: 1 })
      .then((data) => {
        if (cancelled) return;
        const prediction = data?.prediction;
        const quotes = (prediction?.quotes || []).map((quote) => ({
          origin: prediction.origin,
          destination: prediction.destination,
          date: quote.date,
          dayOfWeek: quote.dayOfWeek,
          predictedFare: Number(quote.predictedFare),
        }));
        setState({ status: "ready", quotes, error: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          quotes: [],
          error: error?.message || "Bus fares are unavailable for this route.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [origin, destination, startDate]);

  if (!destination) return null;

  return (
    <div className="mb-8 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <Bus className="w-5 h-5 text-[#2563EB]" />
            <h2 className="text-xl font-bold text-slate-800">
              Bus Fare: {origin} → {destination}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {selectable ? "Choose this to travel by bus for this leg" : `Predicted fare for ${startDate}`}
          </p>
        </div>
      </div>

      {state.status === "loading" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center gap-3 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
          <span className="text-sm font-medium">
            Fetching bus fare predictions for {origin} → {destination}...
          </span>
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          {state.error}
        </div>
      )}

      {state.status === "ready" && state.quotes.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          No bus fares were predicted for this route.
        </div>
      )}

      {state.status === "ready" && state.quotes.length > 0 && (
        <div className="grid gap-5 md:grid-cols-3">
          {state.quotes.map((quote, index) => (
            <BusCard
              key={`${quote.date}-${quote.predictedFare}`}
              quote={quote}
              index={index}
              selectable={selectable}
              chosen={selectable && isBusSelected?.(quote, direction)}
              onToggle={(q) => onToggleBus?.(q, direction)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// OpenWeather's own icon PNGs are tiny (50px) low-detail rasters that turn
// muddy the moment they're scaled up in a card — crisp lucide SVGs read much
// cleaner at any size and match the rest of the app's icon language. Mapped
// from OpenWeather's two-digit condition group (see
// https://openweathermap.org/weather-conditions), with day/night variants
// swapped from the "d"/"n" suffix where lucide has one.
const WEATHER_ICON_BY_GROUP = {
  "01": { day: Sun, night: Moon, color: "text-amber-400" },
  "02": { day: CloudSun, night: CloudMoon, color: "text-amber-400" },
  "03": { day: Cloud, night: Cloud, color: "text-slate-400" },
  "04": { day: Cloudy, night: Cloudy, color: "text-slate-500" },
  "09": { day: CloudDrizzle, night: CloudDrizzle, color: "text-blue-400" },
  "10": { day: CloudSunRain, night: CloudMoonRain, color: "text-blue-500" },
  "11": { day: CloudLightning, night: CloudLightning, color: "text-indigo-500" },
  "13": { day: CloudSnow, night: CloudSnow, color: "text-sky-300" },
  "50": { day: CloudFog, night: CloudFog, color: "text-slate-300" },
};

function weatherIcon(owmCode) {
  const entry = WEATHER_ICON_BY_GROUP[String(owmCode || "").slice(0, 2)];
  if (!entry) return { Icon: Cloud, color: "text-slate-400" };
  return { Icon: String(owmCode).endsWith("n") ? entry.night : entry.day, color: entry.color };
}

/**
 * Destination weather, fetched server-side during generation (best-effort —
 * see weather.service.ts `getWeatherForCity`) and stored on the itinerary.
 * Renders nothing when the lookup failed or OpenWeather wasn't configured.
 */
function WeatherCard({ weather, destination, startDate, endDate }) {
  if (!weather?.current) return null;
  const { current, forecast } = weather;

  // OpenWeather's free tier only forecasts ~5 days ahead, fetched once at
  // generation time - so the raw list is "the next 5 days from whenever the
  // trip was generated," not the trip's actual dates. Showing that unfiltered
  // (as this used to) is actively misleading once the trip is more than a
  // few days out. Keep only the days that actually fall in the trip window.
  const tripForecast = (forecast || []).filter(
    (day) => (!startDate || day.date >= startDate) && (!endDate || day.date <= endDate),
  );

  const currentIcon = weatherIcon(current.icon);

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 to-white p-4 flex flex-wrap items-center gap-4">
      <div className="w-14 h-14 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
        <currentIcon.Icon className={`w-8 h-8 ${currentIcon.color}`} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Weather in {destination}
        </p>
        <p className="text-2xl font-extrabold text-slate-800">
          {current.tempC}°C
          <span className="text-sm font-medium text-slate-500 ml-1.5">{current.condition}</span>
        </p>
        <p className="text-xs text-slate-500">
          High {current.highC}° · Low {current.lowC}° · Feels like {current.feelsLikeC}°
        </p>
      </div>
      {tripForecast.length > 0 ? (
        <div className="flex gap-3 ml-auto">
          {tripForecast.map((day) => {
            const dayIcon = weatherIcon(day.icon);
            return (
              <div key={day.date} className="text-center">
                <p className="text-[10px] font-semibold text-slate-500">
                  {day.day} {new Date(day.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </p>
                <dayIcon.Icon className={`w-6 h-6 mx-auto my-1 ${dayIcon.color}`} strokeWidth={1.75} />
                <p className="text-[10px] text-slate-500">
                  {day.highC}°/{day.lowC}°
                </p>
              </div>
            );
          })}
        </div>
      ) : forecast?.length > 0 ? (
        <p className="text-xs text-slate-400 italic ml-auto max-w-[180px]">
          Day-by-day forecast opens up closer to your travel dates.
        </p>
      ) : null}
    </div>
  );
}

/** Nudge toward a transport mode by trip tier: luxury/premium always offers
 * flight; budget nudges toward the cheaper ground modes. Standard trips get
 * no strong nudge either way. */
function recommendedTransportMode(itinerary) {
  const tier = itinerary?.accommodationType;
  if (tier === "luxury" || tier === "premium") return "flight";
  if (tier === "budget") return "ground";
  return null;
}

const TRANSPORT_MODE_LABELS = { flight: "✈ Flight chosen", train: "🚆 Train chosen", bus: "🚌 Bus chosen" };

/**
 * One leg (outbound or return) of the trip's transport choices: flight,
 * train, and bus, with at most one chosen. Collapses to a one-line summary
 * the first time a mode is chosen, and can be reopened.
 */
function TransportDirectionGroup({
  title,
  dateLabel,
  itinerary,
  source,
  date,
  direction,
  selectable,
  isFlightSelected,
  isTrainSelected,
  isBusSelected,
  onToggleFlight,
  onToggleTrain,
  onToggleBus,
  getChosenTransport,
}) {
  const chosen = getChosenTransport?.(direction);
  const [open, setOpen] = useState(true);
  const wasChosenRef = useRef(Boolean(chosen));

  useEffect(() => {
    if (chosen && !wasChosenRef.current) setOpen(false);
    wasChosenRef.current = Boolean(chosen);
  }, [chosen]);

  const recommended = recommendedTransportMode(itinerary);

  return (
    <div className="mb-8 mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {chosen && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
              {TRANSPORT_MODE_LABELS[chosen.mode]}
            </span>
          )}
          {open ? (
            <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100">
          {recommended && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg mt-4 w-fit">
              <Sparkles className="w-3.5 h-3.5" />
              {recommended === "flight"
                ? "Recommended for your trip: Flight"
                : "Budget tip: train or bus usually costs less than flying"}
            </div>
          )}
          <FlightPredictions
            itinerary={itinerary}
            source={source}
            date={date}
            direction={direction}
            selectable={selectable}
            isFlightSelected={isFlightSelected}
            onToggleFlight={onToggleFlight}
          />
          <RailPredictions
            itinerary={itinerary}
            source={source}
            date={date}
            direction={direction}
            selectable={selectable}
            isTrainSelected={isTrainSelected}
            onToggleTrain={onToggleTrain}
          />
          <BusPredictions
            itinerary={itinerary}
            source={source}
            date={date}
            direction={direction}
            selectable={selectable}
            isBusSelected={isBusSelected}
            onToggleBus={onToggleBus}
          />
        </div>
      )}
    </div>
  );
}

/** The itinerary's full transport picker: a Going leg and a Returning leg,
 * each independent — flying out and busing back is a normal combination. */
function TransportSection({
  itinerary,
  sourceCity,
  selectable,
  isFlightSelected,
  isTrainSelected,
  isBusSelected,
  onToggleFlight,
  onToggleTrain,
  onToggleBus,
  getChosenTransport,
}) {
  return (
    <>
      <TransportDirectionGroup
        title="Going"
        dateLabel={itinerary?.startDate ? `Departing ${itinerary.startDate}` : "Departure"}
        itinerary={itinerary}
        source={sourceCity}
        date={itinerary?.startDate}
        direction="outbound"
        selectable={selectable}
        isFlightSelected={isFlightSelected}
        isTrainSelected={isTrainSelected}
        isBusSelected={isBusSelected}
        onToggleFlight={onToggleFlight}
        onToggleTrain={onToggleTrain}
        onToggleBus={onToggleBus}
        getChosenTransport={getChosenTransport}
      />
      <TransportDirectionGroup
        title="Returning"
        dateLabel={itinerary?.endDate ? `Returning ${itinerary.endDate}` : "Return"}
        itinerary={itinerary}
        source={sourceCity}
        date={itinerary?.endDate}
        direction="return"
        selectable={selectable}
        isFlightSelected={isFlightSelected}
        isTrainSelected={isTrainSelected}
        isBusSelected={isBusSelected}
        onToggleFlight={onToggleFlight}
        onToggleTrain={onToggleTrain}
        onToggleBus={onToggleBus}
        getChosenTransport={getChosenTransport}
      />
    </>
  );
}


/* ── Item selection ──────────────────────────────────────────────────────────
 * Every item in a generated itinerary can be ticked or unticked, and only the
 * ticked ones reach the downloaded PDF.
 *
 * Selections are stored as EXCLUSIONS, keyed by position, so that anything
 * added later — a regenerated day, an activity typed into the day editor — is
 * selected by default, and so that an itinerary saved before this feature
 * existed renders and exports exactly as it used to. The same key strings are
 * rebuilt server-side in pdf.service.ts.
 */

function selectionKey(kind, ...parts) {
  return [kind, ...parts].join(":");
}

// Flights are predicted per-request by the ML service and are not part of the
// stored itinerary, so a chosen flight is stored in full (an inclusion) rather
// than as the absence of an exclusion.
function flightKey(flight) {
  return [flight?.airline, flight?.flightNumber, flight?.date].join("|");
}

// The rail model identifies no train, so a chosen train IS its route and date.
function trainKey(train) {
  return [train?.origin, train?.destination, train?.date].join("|");
}

// Same deal for buses: no operator/service identity, just route + date.
function busKey(bus) {
  return [bus?.origin, bus?.destination, bus?.date].join("|");
}

// A direction (outbound/return) holds at most one chosen transport mode. An
// entry saved before the outbound/return split has no `direction` and is
// treated as "outbound".
function entryDirection(entry) {
  return entry.direction || "outbound";
}
function pruneDirection(list, direction) {
  return list.filter((entry) => entryDirection(entry) !== direction);
}

function useItinerarySelections(itinerary, readOnly) {
  const itineraryId = itinerary?.id;

  // Hotels default to UNselected until the traveler picks one; places and
  // activities default to selected, as before. A freshly generated itinerary
  // has no saved `selections` yet (the field is absent, not an empty object),
  // so that's the signal to seed `excluded` with every hotel key; a
  // previously saved itinerary keeps whatever was already saved untouched.
  const fromItinerary = () => {
    const saved = itinerary?.selections;
    const hotelCount = Array.isArray(itinerary?.accommodations) ? itinerary.accommodations.length : 0;
    const excluded = saved
      ? new Set(saved.excluded || [])
      : new Set(Array.from({ length: hotelCount }, (_, i) => selectionKey("hotel", i)));
    return {
      excluded,
      flights: saved?.flights || [],
      trains: saved?.trains || [],
      buses: saved?.buses || [],
    };
  };

  const [selections, setSelections] = useState(fromItinerary);
  const [saveState, setSaveState] = useState("idle");

  // Saves are chained rather than fired in parallel: each PATCH merges the
  // whole selections object server-side, so two overlapping writes could
  // otherwise land out of order and resurrect an unticked item.
  const queue = useRef(Promise.resolve());

  // Reloads the ticks when a DIFFERENT itinerary is shown. Done during render
  // rather than in an effect (React's documented "adjust state when a prop
  // changes" pattern) so there is no extra render pass showing the previous
  // trip's selections.
  //
  // Keyed on the id alone, never on `itinerary`: that object is rebuilt on
  // every save response, and re-syncing from it would clobber a tick the user
  // made while the previous save was still in flight.
  const [syncedId, setSyncedId] = useState(itineraryId);
  if (syncedId !== itineraryId) {
    setSyncedId(itineraryId);
    setSelections(fromItinerary());
    setSaveState("idle");
  }

  const persist = useCallback(
    (next) => {
      if (!itineraryId || readOnly) return;
      setSaveState("saving");
      queue.current = queue.current
        .then(() =>
          saveItinerarySelections(itineraryId, {
            excluded: [...next.excluded],
            flights: next.flights,
            trains: next.trains,
            buses: next.buses,
          }),
        )
        .then(() => setSaveState("saved"))
        .catch((err) => {
          console.warn("Failed to save itinerary selections:", err);
          setSaveState("error");
        });
    },
    [itineraryId, readOnly],
  );

  // `selections` is read straight from the render that produced the handler,
  // which is current by the time a click fires — React re-renders between user
  // events, so there is no stale-closure window to guard against.
  const commit = useCallback(
    (next) => {
      setSelections(next);
      persist(next);
    },
    [persist],
  );

  const toggle = useCallback(
    (key) => {
      const excluded = new Set(selections.excluded);
      if (excluded.has(key)) excluded.delete(key);
      else excluded.add(key);
      commit({ ...selections, excluded });
    },
    [commit, selections],
  );

  const toggleFlight = useCallback(
    (flight, direction = "outbound") => {
      const key = flightKey(flight);
      const alreadyChosen = selections.flights.some(
        (f) => flightKey(f) === key && entryDirection(f) === direction,
      );
      const flights = pruneDirection(selections.flights, direction);
      commit({
        ...selections,
        flights: alreadyChosen ? flights : [...flights, { ...flight, direction }],
        trains: pruneDirection(selections.trains, direction),
        buses: pruneDirection(selections.buses, direction),
      });
    },
    [commit, selections],
  );

  const toggleTrain = useCallback(
    (train, direction = "outbound") => {
      const key = trainKey(train);
      const alreadyChosen = selections.trains.some(
        (t) => trainKey(t) === key && entryDirection(t) === direction,
      );
      const trains = pruneDirection(selections.trains, direction);
      commit({
        ...selections,
        trains: alreadyChosen ? trains : [...trains, { ...train, direction }],
        flights: pruneDirection(selections.flights, direction),
        buses: pruneDirection(selections.buses, direction),
      });
    },
    [commit, selections],
  );

  const toggleBus = useCallback(
    (bus, direction = "outbound") => {
      const key = busKey(bus);
      const alreadyChosen = selections.buses.some(
        (b) => busKey(b) === key && entryDirection(b) === direction,
      );
      const buses = pruneDirection(selections.buses, direction);
      commit({
        ...selections,
        buses: alreadyChosen ? buses : [...buses, { ...bus, direction }],
        flights: pruneDirection(selections.flights, direction),
        trains: pruneDirection(selections.trains, direction),
      });
    },
    [commit, selections],
  );

  const isSelected = useCallback((key) => !selections.excluded.has(key), [selections]);

  const isFlightSelected = useCallback(
    (flight, direction = "outbound") =>
      selections.flights.some((f) => flightKey(f) === flightKey(flight) && entryDirection(f) === direction),
    [selections],
  );

  const isTrainSelected = useCallback(
    (train, direction = "outbound") =>
      selections.trains.some((t) => trainKey(t) === trainKey(train) && entryDirection(t) === direction),
    [selections],
  );

  const isBusSelected = useCallback(
    (bus, direction = "outbound") =>
      selections.buses.some((b) => busKey(b) === busKey(bus) && entryDirection(b) === direction),
    [selections],
  );

  // What's chosen for a direction, whichever mode it is — drives the
  // collapse-after-choosing summary line.
  const getChosenTransport = useCallback(
    (direction) => {
      const flight = selections.flights.find((f) => entryDirection(f) === direction);
      if (flight) return { mode: "flight", item: flight };
      const train = selections.trains.find((t) => entryDirection(t) === direction);
      if (train) return { mode: "train", item: train };
      const bus = selections.buses.find((b) => entryDirection(b) === direction);
      if (bus) return { mode: "bus", item: bus };
      return null;
    },
    [selections],
  );

  return {
    isSelected,
    isFlightSelected,
    isTrainSelected,
    isBusSelected,
    getChosenTransport,
    toggle,
    toggleFlight,
    toggleTrain,
    toggleBus,
    saveState,
    selections,
  };
}

/**
 * Keeps a heavy child (a live chart) unloaded until the traveler explicitly
 * asks for it. An auto-load-on-scroll-near trigger was tried here first, but
 * this section sits near the top of a long page, so it barely helped — it
 * still loaded almost immediately. `minHeight` sizes the placeholder/button
 * so there's no layout jump when the real content mounts in.
 */
function LazyMount({ children, minHeight = 0, label = "Load" }) {
  const [loaded, setLoaded] = useState(false);
  if (loaded) return children;
  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      className="w-full flex items-center justify-center text-sm font-semibold text-slate-500 hover:text-[#2563EB] hover:bg-slate-50 rounded-2xl border border-slate-200 transition-colors"
      style={{ minHeight }}
    >
      {label}
    </button>
  );
}

/**
 * The tick box shown on every selectable item. Rendered as a real checkbox so
 * it is keyboard reachable and announced by screen readers; `label` is what a
 * screen reader reads, since the visible text belongs to the card around it.
 */
function SelectBox({ checked, onChange, label, className = "" }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className={`h-4 w-4 flex-shrink-0 cursor-pointer rounded border-slate-300 text-[#2563EB] accent-[#2563EB] focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 ${className}`}
    />
  );
}

function SelectionStatus({ saveState }) {
  if (saveState === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Loader2 size={12} className="animate-spin" /> Saving your picks...
      </span>
    );
  }
  if (saveState === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <CheckCircle size={12} /> Picks saved
      </span>
    );
  }
  if (saveState === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
        <AlertCircle size={12} /> Couldn't save your picks
      </span>
    );
  }
  return null;
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
  onEmailPdf,
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
  const location = useLocation();

  // Called unconditionally, above the early returns below: hooks cannot sit
  // behind a conditional return.
  const {
    isSelected,
    isFlightSelected,
    isTrainSelected,
    isBusSelected,
    getChosenTransport,
    toggle,
    toggleFlight,
    toggleTrain,
    toggleBus,
    saveState,
    selections,
  } = useItinerarySelections(itinerary, readOnly);

  // A shared itinerary is somebody else's document, so it is shown whole and
  // read-only rather than offering ticks that could never be saved.
  const selectable = !readOnly && Boolean(itinerary?.id);

  // Derived above the early returns below, because the count memo depends on
  // them and a hook cannot run conditionally. Memoised so a new array identity
  // on every render doesn't invalidate that memo.
  const accommodations = useMemo(() => itinerary?.accommodations || [], [itinerary]);
  const placesToVisit = useMemo(() => itinerary?.placesToVisit || [], [itinerary]);
  const days = useMemo(() => itinerary?.days || [], [itinerary]);

  const selectedCount = useMemo(
    () => ({
      hotels: accommodations.filter((_acc, i) => !selections.excluded.has(selectionKey("hotel", i)))
        .length,
      places: placesToVisit.filter((_place, i) => !selections.excluded.has(selectionKey("place", i)))
        .length,
      activities: days.reduce(
        (total, day) =>
          total +
          (day.activities || []).filter(
            (_activity, i) => !selections.excluded.has(selectionKey("activity", day.day, i)),
          ).length,
        0,
      ),
      flights: selections.flights.length,
      trains: selections.trains.length,
      buses: selections.buses.length,
    }),
    [selections, accommodations, placesToVisit, days],
  );

  // "N stays, M flights, ... and K activities" — built from selectedCount so
  // flight/train/bus are only mentioned when one's actually chosen (at most
  // one of each per direction), while hotels/places/activities always show.
  const selectionSummary = useMemo(() => {
    const pluralize = (n, singular, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;
    const parts = [
      pluralize(selectedCount.hotels, "stay"),
      selectedCount.flights > 0 && pluralize(selectedCount.flights, "flight"),
      selectedCount.trains > 0 && pluralize(selectedCount.trains, "train"),
      selectedCount.buses > 0 && pluralize(selectedCount.buses, "bus", "buses"),
      pluralize(selectedCount.places, "place"),
      pluralize(selectedCount.activities, "activity", "activities"),
    ].filter(Boolean);
    if (parts.length <= 1) return parts.join("");
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  }, [selectedCount]);

  // Total Estimate, recomputed live from what's actually ticked rather than
  // the AI's static one-shot figure. Accommodation and transport come from
  // the selected hotel(s)/flight/train/bus; activities from each selected
  // activity's own `cost`. Food and miscellaneous have no per-item checkbox
  // to tie them to, so they stay the AI's static estimate. A category with
  // nothing selected yet falls back to its static estimate too, so the
  // receipt doesn't show ₹0 before the traveler has picked anything (hotels
  // in particular default to unselected — see ADR 0005 update).
  const liveBudget = useMemo(() => {
    const staticBudget = itinerary?.budgetBreakdown || {};
    const currency = staticBudget.currency || "INR";
    const nights = Math.max(1, (itinerary?.totalDays || 1) - 1);
    const tripDays = itinerary?.totalDays || 1;

    /*
     * What the server actually costed each line from (`budgetExplain`, written
     * by buildBudget). Absent on itineraries saved before it existed, so every
     * read is optional and every note falls back to saying nothing rather than
     * guessing at arithmetic that may not be what produced the number.
     */
    const explain = itinerary?.budgetExplain || null;
    const people = Number(explain?.people) || 0;
    const rooms = Number(explain?.rooms) || 1;
    const notes = {};

    // Hotels are a checklist, not mutually exclusive (a traveler can tick
    // several to compare in their export) — but the trip itself is still one
    // stay, matching how the server prices accommodation (costAccommodation
    // only ever prices accommodations[0]). Summing every ticked hotel would
    // inflate the estimate as if booking all of them, so only the first
    // selected one counts toward the total.
    const selectedHotels = accommodations.filter(
      (_acc, i) => !selections.excluded.has(selectionKey("hotel", i)),
    );
    const firstHotel = selectedHotels[0];
    const hotelWindowTotal = Number(firstHotel?.totalPrice) || 0;
    const hotelNightly = Number(firstHotel?.pricePerNight) || 0;
    const accommodation = firstHotel
      ? (hotelWindowTotal || hotelNightly * nights) * rooms
      : Number(staticBudget.accommodation) || 0;

    if (firstHotel) {
      const roomPart = rooms > 1 ? ` × ${rooms} rooms` : "";
      notes.accommodation = hotelWindowTotal
        ? `${firstHotel.name} · ${formatCurrency(hotelWindowTotal)} for the stay${roomPart}`
        : `${firstHotel.name} · ${formatCurrency(hotelNightly)}/night × ${nights} night${nights > 1 ? "s" : ""}${roomPart}`;
      if (selectedHotels.length > 1) {
        notes.accommodation += ` (first of ${selectedHotels.length} ticked)`;
      }
    } else if (explain?.accommodation?.hotel) {
      notes.accommodation = `${explain.accommodation.hotel} · ${formatCurrency(
        explain.accommodation.nightlyRate,
      )}/night × ${explain.accommodation.nights} night${explain.accommodation.nights > 1 ? "s" : ""}${
        explain.accommodation.rooms > 1 ? ` × ${explain.accommodation.rooms} rooms` : ""
      } — no stay ticked yet`;
    }

    /*
     * Predicted fares are PER PERSON (the ML services price one seat), which
     * is also how the server costs the intercity leg — so a ticked fare is
     * multiplied by party size here too. Without `people` (older itineraries
     * carry no budgetExplain) it stays a single fare rather than inventing a
     * multiplier.
     */
    const chosenFares = [...selections.flights, ...selections.trains, ...selections.buses];
    const seats = people || 1;
    const localTransport = Number(explain?.transport?.local) || 0;
    const transportSum = chosenFares.reduce(
      (sum, item) => sum + (Number(item.predictedFare) || 0) * seats,
      0,
    );
    const transport =
      chosenFares.length > 0 ? transportSum + localTransport : Number(staticBudget.transport) || 0;

    if (chosenFares.length > 0) {
      notes.transport = chosenFares
        .map((item) => {
          const name = item.airline || item.operator || `${item.origin} → ${item.destination}`;
          return `${name} ${formatCurrency(item.predictedFare || 0)}${
            seats > 1 ? ` × ${seats} travellers` : ""
          }`;
        })
        .join(" + ");
      if (localTransport > 0) {
        notes.transport += ` + ${formatCurrency(localTransport)} local travel`;
      }
    } else if (explain?.transport) {
      const t = explain.transport;
      notes.transport = `${t.estimated ? "Typical" : "Quoted"} ${t.mode} fare ${formatCurrency(
        t.farePerPerson,
      )} × ${t.people} traveller${t.people > 1 ? "s" : ""}${
        t.local > 0 ? ` + ${formatCurrency(t.local)} local travel` : ""
      } — nothing ticked yet`;
    }

    const activitiesTotal = (itinerary?.days || []).reduce((sum, day) => {
      const dayActivities = day.activities || [];
      return (
        sum +
        dayActivities.reduce((daySum, activity, i) => {
          if (selections.excluded.has(selectionKey("activity", day.day, i))) return daySum;
          return daySum + (Number(activity.cost) || 0);
        }, 0)
      );
    }, 0);

    const pricedActivities = (itinerary?.days || []).reduce((count, day) => {
      const dayActivities = day.activities || [];
      return (
        count +
        dayActivities.filter(
          (activity, i) =>
            !selections.excluded.has(selectionKey("activity", day.day, i)) &&
            (Number(activity.cost) || 0) > 0,
        ).length
      );
    }, 0);

    if (pricedActivities > 0) {
      notes.activities = `${pricedActivities} ticked ${
        pricedActivities === 1 ? "activity" : "activities"
      } with an entry or booking cost`;
    }

    const food = Number(staticBudget.food) || 0;
    if (explain?.food?.source === "meals") {
      notes.food = `${explain.food.mealCount} meal${
        explain.food.mealCount === 1 ? "" : "s"
      } priced in the day plan`;
    } else if (explain?.food) {
      notes.food = `${formatCurrency(explain.food.perPersonPerDay)} per person per day × ${
        explain.food.people
      } traveller${explain.food.people > 1 ? "s" : ""} × ${explain.food.days} day${
        explain.food.days > 1 ? "s" : ""
      }`;
    }

    // Recomputed rather than carried over: the static figure was 5% of the
    // AI's original lines, so it drifts as soon as a different hotel or fare
    // is ticked.
    const miscRate = Number(explain?.miscellaneous?.rate) || 0.05;
    const miscellaneous = Math.round(
      (accommodation + food + transport + activitiesTotal) * miscRate,
    );
    notes.miscellaneous = `${Math.round(miscRate * 100)}% buffer on the lines above`;

    const total = accommodation + food + transport + activitiesTotal + miscellaneous;

    const requestedBudget = Number(itinerary?.budgetVerdict?.requestedBudget) || 0;
    const withinBudget = requestedBudget > 0 ? total <= requestedBudget : null;
    const difference = requestedBudget > 0 ? Math.abs(total - requestedBudget) : 0;

    return {
      accommodation,
      food,
      transport,
      activities: activitiesTotal,
      miscellaneous,
      total,
      currency,
      requestedBudget,
      withinBudget,
      difference,
      notes,
      people,
      days: tripDays,
    };
  }, [itinerary, accommodations, selections]);

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

  /*
   * Present only on itineraries generated after budget reconciliation landed —
   * older saved trips have no verdict and simply show the breakdown alone.
   */
  const budgetVerdict = itinerary?.budgetVerdict ?? null;

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

  const sourceCity =
    location.state?.fromCity ||
    location.state?.origin ||
    itinerary?.origin ||
    itinerary?.fromCity ||
    itinerary?.userAnswers?.fromCity ||
    itinerary?.userAnswers?.origin ||
    (itinerary?.transport && itinerary?.transport[0]?.from) ||
    "Delhi";

  return (
    <>
      <TicketContainer className="p-6 sm:p-10">
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

        <WeatherCard
          weather={itinerary.weather}
          destination={itinerary.destination}
          startDate={itinerary.startDate}
          endDate={itinerary.endDate}
        />

        <div className="prose prose-slate max-w-none">
          <h2 className="text-xl font-bold mb-3">Overview</h2>
          <p className="text-slate-600">{itinerary.overview}</p>

          <ItineraryMap
            source={sourceCity}
            destination={itinerary.destination}
            places={placesToVisit}
          />

          <TransportSection
            itinerary={itinerary}
            sourceCity={sourceCity}
            selectable={selectable}
            isFlightSelected={isFlightSelected}
            isTrainSelected={isTrainSelected}
            isBusSelected={isBusSelected}
            onToggleFlight={toggleFlight}
            onToggleTrain={toggleTrain}
            onToggleBus={toggleBus}
            getChosenTransport={getChosenTransport}
          />

          <LazyMount minHeight={300} label="Load price history chart">
            <PriceHistoryGraph itinerary={itinerary} sourceCity={sourceCity} />
          </LazyMount>

        
          {/* ── Where to Stay ── */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Where to Stay</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {accommodations.some((acc) => acc.source === "serpapi")
                    ? "Live rates and ratings for your dates — tick the stay you want"
                    : "Recommended stays for your trip"}
                </p>
              </div>
              {accommodations.some((acc) => acc.source === "serpapi") && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                  Live availability
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {accommodations.map((acc, i) => {
                const key = selectionKey("hotel", i);
                const checked = !selectable || isSelected(key);
                const safeThumbnail = safeHttpUrl(acc.thumbnailUrl);
                const safeBookingLink = safeHttpUrl(acc.bookingLink);
                return (
                  <div
                    key={`${acc.name}-${i}`}
                    className={`relative rounded-xl overflow-hidden bg-white transition-[opacity,box-shadow] ${
                      checked ? "border border-slate-200 shadow-sm" : "border border-slate-200 opacity-50"
                    }`}
                  >
                    {selectable && (
                      <SelectBox
                        checked={checked}
                        onChange={() => toggle(key)}
                        label={`Include ${acc.name} in my PDF`}
                        className="absolute top-1.5 right-1.5 z-10 bg-white/90 rounded"
                      />
                    )}

                    {safeThumbnail && (
                      <div className="relative aspect-square overflow-hidden bg-slate-100">
                        <img
                          src={safeThumbnail}
                          alt={acc.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Google's image proxy links expire; a broken photo
                            // should collapse the frame, not show a torn icon.
                            e.currentTarget.parentElement.style.display = "none";
                          }}
                        />
                        {acc.hotelClass ? (
                          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            {acc.hotelClass}-STAR
                          </span>
                        ) : null}
                      </div>
                    )}

                    <div className="p-3">
                      <p className="font-semibold text-slate-900 text-sm truncate">{acc.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 capitalize truncate">
                        {acc.type} · {acc.location}
                      </p>

                      {acc.rating ? (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px]">
                          <Star size={11} className="fill-amber-400 text-amber-400" />
                          <span className="font-bold text-slate-800">{acc.rating}</span>
                          {acc.reviewsCount ? (
                            <span className="text-slate-500">
                              ({acc.reviewsCount.toLocaleString("en-IN")})
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-2 flex items-end justify-between border-t border-dashed border-slate-200 pt-2">
                        <p className="text-sm font-extrabold text-[#2563EB] truncate">
                          ₹{Number(acc.pricePerNight || 0).toLocaleString("en-IN")}
                          <span className="text-[10px] font-medium text-slate-400"> /night</span>
                        </p>
                        {safeBookingLink && (
                          <a
                            href={safeBookingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-[#2563EB] shrink-0"
                            aria-label={`View deal for ${acc.name}`}
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Places to Visit Section */}
          {placesToVisit.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Places to Visit</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Top attractions & highlights curated for {itinerary.destination || "your trip"}
                  </p>
                </div>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
                  {placesToVisit.length} Attractions
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {placesToVisit.map((place, i) => {
                  const key = selectionKey("place", i);
                  const checked = !selectable || isSelected(key);
                  return (
                    <div key={`${place.name}-${i}`} className="relative">
                      {selectable && (
                        <label className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 shadow-md cursor-pointer">
                          <SelectBox
                            checked={checked}
                            onChange={() => toggle(key)}
                            label={`Include ${place.name} in my PDF`}
                          />
                        </label>
                      )}
                      <div className={checked ? "" : "opacity-45"}>
                        <PlaceTicketCard place={place} destination={itinerary.destination} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
            <div>
              <h2 className="text-xl font-bold">Day-by-Day Schedule</h2>
              {selectable && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Untick anything you don’t want and it will be left out of your PDF
                </p>
              )}
            </div>
            <SelectionStatus saveState={saveState} />
          </div>
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
                    (day.activities || []).map((activity, i) => {
                      const key = selectionKey("activity", day.day, i);
                      const checked = !selectable || isSelected(key);
                      return (
                      <div
                        key={i}
                        className={`flex items-start gap-3 text-sm py-1 border-b border-slate-50 last:border-0 ${
                          checked ? "" : "opacity-45"
                        }`}
                      >
                        {selectable && (
                          <SelectBox
                            checked={checked}
                            onChange={() => toggle(key)}
                            label={`Include ${activity.title || "this activity"} on day ${day.day} in my PDF`}
                            className="mt-1"
                          />
                        )}
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
                      );
                    })
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

          {/* ── Digital Receipt ── */}
          <div className="flex justify-center mb-10 mt-6">
            <div
              style={{ backgroundColor: "#f9f7f1", fontFamily: '"Roboto Mono", "Courier New", monospace' }}
              className="w-full  shadow-xl p-8 text-[#1a1a1a] relative"
            >
              {/* Top jagged edge effect (optional but nice for receipt, using CSS mask or simple border) */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-repeat-x" style={{ backgroundImage: 'radial-gradient(circle, transparent 4px, #f9f7f1 4px)', backgroundSize: '10px 10px', backgroundPosition: 'top -5px left 0' }}></div>
              
              <h3 className="text-center text-4xl font-black uppercase tracking-tighter mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
                Total Estimate
              </h3>

              <div className="text-xs font-bold mb-4 tracking-widest text-slate-500">
                TRIP BREAKDOWN
              </div>

              <div className="space-y-3.5">
                {[
                  { label: "ACCOMMODATION", key: "accommodation" },
                  { label: "FOOD & DINING",  key: "food" },
                  { label: "TRANSPORT",      key: "transport" },
                  { label: "ACTIVITIES",     key: "activities" },
                  { label: "MISCELLANEOUS",  key: "miscellaneous" },
                ].map(({ label, key }) => {
                  const value = liveBudget[key] ?? 0;
                  if (value === 0) return null; // Don't show 0 value items if we want cleaner look, but up to us.
                  const note = liveBudget.notes?.[key];
                  return (
                    <div key={key}>
                      <div className="flex items-end text-sm">
                        <span className="shrink-0 font-medium">{label}</span>
                        <span className="flex-grow border-b-2 border-dotted border-slate-300 mx-2 mb-1.5 opacity-50"></span>
                        <span className="shrink-0 font-bold tabular-nums">
                          {formatCurrency(value)}
                        </span>
                      </div>
                      {/* What drove the number, in the same arithmetic the
                          server used - so a surprising line can be traced back
                          to the hotel, fare or party size behind it. */}
                      {note && (
                        <p
                          className="text-[11px] leading-snug text-slate-500 mt-0.5 pr-1"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          {note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-4 border-t-2 border-slate-800 flex justify-between items-end">
                <span className="font-bold uppercase tracking-wider text-sm">Total Estimate</span>
                <span className="text-xl font-bold tabular-nums">{formatCurrency(liveBudget.total)}</span>
              </div>

              {/* ── Against the preferred budget ── */}
              {liveBudget.requestedBudget > 0 && (
                <div className="mt-5 pt-4 border-t border-dashed border-slate-400">
                  <div className="flex items-end text-sm">
                    <span className="shrink-0 font-medium">PREFERRED BUDGET</span>
                    <span className="flex-grow border-b-2 border-dotted border-slate-300 mx-2 mb-1.5 opacity-50" />
                    <span className="shrink-0 font-bold tabular-nums">
                      {formatCurrency(liveBudget.requestedBudget)}
                    </span>
                  </div>

                  <div
                    className={`flex items-end text-sm mt-2 ${
                      liveBudget.withinBudget ? "text-emerald-700" : "text-amber-800"
                    }`}
                  >
                    <span className="shrink-0 font-medium">
                      {liveBudget.withinBudget ? "UNDER BY" : "OVER BY"}
                    </span>
                    <span className="flex-grow border-b-2 border-dotted border-slate-300 mx-2 mb-1.5 opacity-50" />
                    <span className="shrink-0 font-bold tabular-nums">
                      {formatCurrency(Math.abs(liveBudget.difference ?? 0))}
                    </span>
                  </div>

                  {!liveBudget.withinBudget && budgetVerdict.suggestedBudget > 0 && (
                    <div className="flex items-end text-sm mt-2 font-bold">
                      <span className="shrink-0">SUGGESTED BUDGET</span>
                      <span className="flex-grow border-b-2 border-dotted border-slate-300 mx-2 mb-1.5 opacity-50" />
                      <span className="shrink-0 tabular-nums">
                        {formatCurrency(budgetVerdict.suggestedBudget)}
                      </span>
                    </div>
                  )}

                  {budgetVerdict.notes?.length > 0 && (
                    <ul
                      className="mt-4 space-y-1.5 text-[11px] leading-snug text-slate-600"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {budgetVerdict.notes.map((note) => (
                        <li key={note} className="flex gap-1.5">
                          <span aria-hidden="true">&middot;</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-12 flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <span>Detailed breakdown</span>
                <span>{itinerary.totalDays} DAYS</span>
              </div>
              
               <div className="absolute bottom-0 left-0 right-0 h-2 bg-repeat-x" style={{ backgroundImage: 'radial-gradient(circle, transparent 4px, #f9f7f1 4px)', backgroundSize: '10px 10px', backgroundPosition: 'bottom -5px left 0', transform: 'rotate(180deg)' }}></div>
            </div>
          </div>
        </div>
      </TicketContainer>

      {selectable && (
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-slate-600">
            Your PDF and email will include <span className="font-semibold text-slate-800">{selectionSummary}</span>.
          </p>
          <SelectionStatus saveState={saveState} />
        </div>
      )}

      <div className="mt-8 flex gap-3 flex-wrap">
        {onDownloadPdf && (
          <button
            type="button"
            onClick={onDownloadPdf}
            // The PDF is rendered from the saved document, so downloading while
            // a selection save is still in flight would export the previous
            // set of ticks.
            disabled={saveState === "saving"}
            className="flex-1 min-w-[160px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            {saveState === "saving" ? "Saving picks..." : "Download PDF"}
          </button>
        )}
        {onEmailPdf && (
          <button
            type="button"
            onClick={onEmailPdf}
            disabled={saveState === "saving"}
            className="flex-1 min-w-[160px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Mail size={18} /> Email PDF
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
    </>
  );
}

