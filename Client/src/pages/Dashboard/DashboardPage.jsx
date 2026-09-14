import { useEffect, useMemo, useState } from "react";
import {
  fetchUserProfile,
  fetchBookings,
  fetchItineraries,
  fetchFlightFareHistory,
} from "../../lib/authApi";
import UserNavbar from "../../components/layout/UserNavbar";
import Footer from "../../components/layout/Footer";

import WelcomeBanner from "./components/WelcomeBanner";
import TravelCostChart from "./components/TravelCostChart";
import TravelCostOverview from "./components/TravelCostOverview";
import WeatherWidget from "./components/WeatherWidget";
import SeasonalPick from "./components/SeasonalPick";
import JourneyStats from "./components/JourneyStats";
import { buildTravelCostView, uniqueDestinations } from "./lib/buildTravelCostView";

// Shown until the user saves a home city on their profile, so the weather card
// always has something real to display instead of an empty state.
const DEFAULT_WEATHER_CITY = "Nagpur";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [itineraries, setItineraries] = useState([]);
  const [itineraryCount, setItineraryCount] = useState(0);
  const [fareHistory, setFareHistory] = useState([]);
  const [costsLoading, setCostsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchUserProfile(),
      fetchBookings(),
      fetchItineraries(50, 0).catch(() => ({ total: 0, itineraries: [] })),
      fetchFlightFareHistory().catch(() => ({ history: [] })),
    ])
      .then(([profileData, bookingsData, itineraryData, fareData]) => {
        if (!isMounted) return;
        setUser(profileData.user);
        setProfile(profileData.profile);
        setBookings(bookingsData.bookings || []);
        const plans = itineraryData.itineraries || [];
        setItineraries(plans);
        setItineraryCount(Number(itineraryData.total) || plans.length);
        setFareHistory(fareData.history || []);
        setCostsLoading(false);
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Unable to load dashboard.");
          setCostsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const weatherCity = profile?.homeCity?.trim() || DEFAULT_WEATHER_CITY;

  // Derived stats
  const uniquePlaces = uniqueDestinations(itineraries, bookings);
  const costView = useMemo(
    () => buildTravelCostView({ itineraries, fareHistory, bookings }),
    [itineraries, fareHistory, bookings],
  );
  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <UserNavbar />

      <main className="pt-28 pb-0 px-4 sm:px-6 max-w-7xl mx-auto">
        {error && (
          <div className="mb-4 px-4 py-2.5 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">
            {error}
          </div>
        )}

        {/* ── Full page grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-5">
            {/* 1. Welcome Banner */}
            <WelcomeBanner userName={user?.name} />

            {/* Cost chart + Overview side by side */}
            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-5">
              <TravelCostChart costView={costView} loading={costsLoading} />
              <TravelCostOverview costView={costView} />
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex flex-col gap-5">
            {/* 4. Weather Widget */}
            <WeatherWidget city={weatherCity} />

            {/* 5. Seasonal Pick */}
            <SeasonalPick />
          </div>
        </div>

        {/* ── Full-width: Journey Stats ── */}
        <div className="mt-5 mb-10">
          <JourneyStats
            trips={bookings.length}
            places={uniquePlaces}
            itineraries={itineraryCount}
          />
        </div>
      </main>

      {/* ── Footer ── */}
      <Footer className="mt-5" />
    </div>
  );
}
