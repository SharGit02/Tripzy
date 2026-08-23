import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchCurrentUser, fetchBookings } from "../../lib/authApi";
import UserNavbar from "../../components/layout/UserNavbar";

// Dashboard sub-components
import WelcomeBanner from "./components/WelcomeBanner";
import SearchBar from "./components/SearchBar";
import TravelCostChart from "./components/TravelCostChart";
import TravelCostOverview from "./components/TravelCostOverview";
import WeatherWidget from "./components/WeatherWidget";
import SeasonalPick from "./components/SeasonalPick";
import JourneyStats from "./components/JourneyStats";
import DashboardFooter from "./components/DashboardFooter";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    Promise.all([fetchCurrentUser(), fetchBookings()])
      .then(([userData, bookingsData]) => {
        if (!isMounted) return;
        setUser(userData.user);
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

            {/* 2. Search Bar */}
            <SearchBar />

            {/* 3. Cost chart + Overview side by side */}
            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-5">
              <TravelCostChart />
              <TravelCostOverview />
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex flex-col gap-5">
            {/* 4. Weather Widget */}
            <WeatherWidget />

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
