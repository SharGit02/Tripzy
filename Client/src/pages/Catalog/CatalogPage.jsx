import { useCallback, useRef, useState } from "react";
import UserNavbar from "../../components/layout/UserNavbar";
import CatalogHero from "./components/CatalogHero";
import TopPicksSection from "./components/TopPicksSection";
import Footer from "../../components/layout/Footer";
import ItineraryResults from "../Itinerary/ItineraryResults";
import { generateItinerary, downloadItineraryPdf, regenerateItinerary } from "../../lib/authApi";
import {
  parsePlanTripSearch,
} from "./lib/boardingPassToItinerary";

const INITIAL_ITINERARY_STATE = { status: "idle", itinerary: null, itineraryId: null, error: "" };

export default function CatalogPage() {
  const [itineraryState, setItineraryState] = useState(INITIAL_ITINERARY_STATE);
  const [searchError, setSearchError] = useState("");
  const resultsRef = useRef(null);

  const scrollToResults = () => {
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSearch = useCallback(async (search) => {
    const parsed = parsePlanTripSearch(search);
    if (!parsed.success) {
      setSearchError(parsed.error);
      return;
    }

    setSearchError("");
    setItineraryState({ status: "loading", itinerary: null, itineraryId: null, error: "" });
    scrollToResults();

    try {
      const data = await generateItinerary(parsed.payload);
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
      setItineraryState({
        status: "error",
        itinerary: null,
        itineraryId: null,
        error: err instanceof Error ? err.message : "Failed to generate itinerary. Please try again.",
      });
    }
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    try {
      const itin = itineraryState.itinerary;
      const id = itineraryState.itineraryId;
      if (!id) {
        alert("Itinerary ID not available. Please generate the itinerary again.");
        return;
      }
      const response = await downloadItineraryPdf(id);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${String(itin.destination || "trip").replace(/\s+/g, "-")}-itinerary.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download PDF: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }, [itineraryState.itinerary, itineraryState.itineraryId]);

  const handleRegenerate = useCallback(async () => {
    const id = itineraryState.itineraryId;
    if (!id) return;
    const modifications = window.prompt("What changes would you like?");
    if (!modifications) return;
    if (modifications.trim().length < 10) {
      alert("Please describe the changes in at least 10 characters.");
      return;
    }

    setItineraryState((prev) => ({ ...prev, status: "loading", error: "" }));
    scrollToResults();

    try {
      const data = await regenerateItinerary(id, modifications);
      setItineraryState({
        status: "ready",
        itinerary: data.itinerary,
        itineraryId: id,
        error: "",
      });
    } catch (err) {
      setItineraryState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to regenerate itinerary.",
      }));
    }
  }, [itineraryState.itineraryId]);

  const submitting = itineraryState.status === "loading";
  const showResults = itineraryState.status !== "idle";

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#133C55] flex flex-col justify-between">
      <div>
        <UserNavbar />
        <CatalogHero
          onSearch={handleSearch}
          submitting={submitting}
          searchError={searchError}
        />

        <div ref={resultsRef} className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-4">
          {showResults && (
            <ItineraryResults
              status={itineraryState.status}
              itinerary={itineraryState.itinerary}
              error={itineraryState.error}
              onDownloadPdf={handleDownloadPdf}
              onRegenerate={handleRegenerate}
              onPlanAnother={() => setItineraryState(INITIAL_ITINERARY_STATE)}
            />
          )}
        </div>

        {itineraryState.status !== "ready" && itineraryState.status !== "loading" && (
          <TopPicksSection />
        )}
      </div>

      <Footer />
    </div>
  );
}
