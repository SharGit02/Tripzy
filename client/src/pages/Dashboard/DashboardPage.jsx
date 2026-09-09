import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchUserProfile, fetchBookings } from "../../lib/authApi";
import UserNavbar from "../../components/layout/UserNavbar";
import { Plus, MapPin, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

// Dashboard sub-components
import WelcomeBanner from "./components/WelcomeBanner";
import TravelCostChart from "./components/TravelCostChart";
import TravelCostOverview from "./components/TravelCostOverview";
import WeatherWidget from "./components/WeatherWidget";
import SeasonalPick from "./components/SeasonalPick";
import JourneyStats from "./components/JourneyStats";
import DashboardFooter from "./components/DashboardFooter";

// Shown until the user saves a home city on their profile, so the weather card
// always has something real to display instead of an empty state.
const DEFAULT_WEATHER_CITY = "Nagpur";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    // /users/profile returns the user *and* their profile, so it covers both
    // the greeting and the weather card's home city in a single request.
    Promise.all([fetchUserProfile(), fetchBookings()])
      .then(([profileData, bookingsData]) => {
        if (!isMounted) return;
        setUser(profileData.user);
        setProfile(profileData.profile);
        setBookings(bookingsData.bookings || []);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Unable to load dashboard.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const weatherCity = profile?.homeCity?.trim() || DEFAULT_WEATHER_CITY;

  // Derived stats
  const uniquePlaces = new Set(
    bookings.filter((b) => b.destination).map((b) => b.destination.toLowerCase())
  ).size;

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

            {/* 2. Plan New Trip Card */}
            <Link
              to="/itinerary"
              className="group rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Plan a New Trip</h2>
                  <p className="text-blue-100">AI-powered personalized itinerary</p>
                </div>
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Sparkles size={28} className="text-white" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-[#2563EB] flex items-center justify-center font-bold text-sm">
                    <Plus size={16} />
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 text-blue-100 text-sm">
                <span className="flex items-center gap-1"><MapPin size={14} /> Custom destinations</span>
                <span className="flex items-center gap-1"><Sparkles size={14} /> Smart recommendations</span>
              </div>
            </Link>

            {/* 3. Cost chart + Overview side by side */}
            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-5">
              <TravelCostChart />
              <TravelCostOverview />
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
        <div className="mt-5">
          <JourneyStats
            trips={bookings.length}
            places={uniquePlaces}
            itineraries={2}
          />
        </div>
      </main>

      {/* ── Footer ── */}
      <DashboardFooter />
    </div>
  );
}
