import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Footer from "../../components/layout/Footer";
import ItineraryResults from "./ItineraryResults";
import { unwrapItineraryRecord } from "./unwrapItinerary";
import { fetchPublicItinerary } from "../../lib/authApi";
import { downloadItineraryIcs } from "./itineraryToIcs";
import logoImg from "../../assets/images/logo.png";

export default function ShareItineraryPage() {
  const { id } = useParams();
  const [state, setState] = useState({
    status: "loading",
    itinerary: null,
    error: "",
  });

  useEffect(() => {
    if (!id) return undefined;
    const controller = new AbortController();
    fetchPublicItinerary(id)
      .then((data) => {
        if (controller.signal.aborted) return;
        const itinerary = unwrapItineraryRecord(data.itinerary || data);
        if (!itinerary) throw new Error("That itinerary could not be loaded.");
        setState({ status: "ready", itinerary, error: "" });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          itinerary: null,
          error: err instanceof Error ? err.message : "This shared itinerary is unavailable.",
        });
      });
    return () => controller.abort();
  }, [id]);

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#133C55] flex flex-col justify-between">
      <div>
        <header className="pt-6 px-4 sm:px-8 max-w-7xl mx-auto w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImg} alt="Tripzy" className="h-10 w-auto object-contain" />
          </Link>
          <Link to="/plan" className="text-sm font-semibold text-[#2563EB]">
            Plan your own trip
          </Link>
        </header>
        <main className="pt-10 px-4 sm:px-8 pb-16 max-w-7xl mx-auto w-full">
          <ItineraryResults
            status={state.status}
            itinerary={state.itinerary}
            error={state.error}
            readOnly
            onExportIcs={() => downloadItineraryIcs(state.itinerary)}
            loadingTitle="Loading shared itinerary..."
            loadingSubtitle="Fetching this trip plan."
          />
        </main>
      </div>
      <Footer />
    </div>
  );
}
