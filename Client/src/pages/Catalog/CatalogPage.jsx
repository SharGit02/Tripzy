import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserNavbar from "../../components/layout/UserNavbar";
import CatalogHero from "./components/CatalogHero";
import TopPicksSection from "./components/TopPicksSection";
import Footer from "../../components/layout/Footer";
import ItineraryResults from "../Itinerary/ItineraryResults";
import { generateItinerary } from "../../lib/authApi";
import { parsePlanTripSearch } from "./lib/boardingPassToItinerary";

const INITIAL_ITINERARY_STATE = { status: "idle", error: "" };

export default function CatalogPage() {
  const navigate = useNavigate();
  const [itineraryState, setItineraryState] = useState(INITIAL_ITINERARY_STATE);
  const [searchError, setSearchError] = useState("");

  const handleSearch = useCallback(async (search) => {
    const parsed = parsePlanTripSearch(search);
    if (!parsed.success) {
      setSearchError(parsed.error);
      return;
    }

    setSearchError("");
    setItineraryState({ status: "loading", error: "" });

    try {
      const data = await generateItinerary(parsed.payload);
      const itineraryId = data.itineraryId || data.itinerary?.id;
      if (!itineraryId) {
        throw new Error("The itinerary was created, but we didn't get an ID back. Check My Itineraries.");
      }
      navigate(`/plan/${itineraryId}`);
    } catch (err) {
      setItineraryState({
        status: "error",
        error: err instanceof Error ? err.message : "Failed to generate itinerary. Please try again.",
      });
    }
  }, [navigate]);

  const submitting = itineraryState.status === "loading";

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#133C55] flex flex-col justify-between">
      <div>
        <UserNavbar />
        <CatalogHero
          onSearch={handleSearch}
          submitting={submitting}
          searchError={searchError}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-4">
          {(itineraryState.status === "loading" || itineraryState.status === "error") && (
            <ItineraryResults
              status={itineraryState.status}
              itinerary={null}
              error={itineraryState.error}
            />
          )}
        </div>

        {itineraryState.status !== "loading" && <TopPicksSection />}
      </div>

      <Footer />
    </div>
  );
}
