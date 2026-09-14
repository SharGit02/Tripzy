import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import UserNavbar from "../../components/layout/UserNavbar";
import Footer from "../../components/layout/Footer";
import ItineraryResults from "../Itinerary/ItineraryResults";
import { downloadItineraryIcs } from "../Itinerary/itineraryToIcs";
import { useLocationContext } from "../../context/LocationContext";
import { buildTopPickItinerary, getTopPick } from "./lib/topPickItineraries";

export default function TopPickItineraryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { currentCity } = useLocationContext();
  const pick = getTopPick(slug);
  const itinerary = pick ? buildTopPickItinerary(slug, currentCity) : null;

  useEffect(() => {
    if (!itinerary) return;
    if (window.location.hash !== "#book-your-trip") return;
    const t = window.setTimeout(() => {
      document.getElementById("book-your-trip")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [itinerary]);

  if (!itinerary) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col">
        <UserNavbar />
        <main className="pt-32 px-6 max-w-xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-[#0f2442] mb-3">That pick is not available</h1>
          <Link to="/plan" className="text-[#2563EB] font-semibold">
            Back to Plan
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#133C55] flex flex-col justify-between">
      <div>
        <UserNavbar />
        <main className="pt-28 px-4 sm:px-8 pb-16 max-w-7xl mx-auto w-full">
          <Link
            to="/plan"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#2563EB] transition-colors mb-6"
          >
            <ArrowLeft size={15} /> Back to Plan
          </Link>
          <ItineraryResults
            status="ready"
            itinerary={itinerary}
            error=""
            onExportIcs={() => downloadItineraryIcs(itinerary)}
            onPlanAnother={() => navigate("/plan")}
          />
        </main>
      </div>
      <Footer />
    </div>
  );
}
