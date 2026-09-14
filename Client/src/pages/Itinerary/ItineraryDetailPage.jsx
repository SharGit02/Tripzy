import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import UserNavbar from "../../components/layout/UserNavbar";
import Footer from "../../components/layout/Footer";
import ItineraryResults from "./ItineraryResults";
import { unwrapItineraryRecord } from "./unwrapItinerary";
import { downloadItineraryIcs } from "./itineraryToIcs";
import {
  fetchItineraryById,
  downloadItineraryPdf,
  regenerateItinerary,
  updateItinerary,
  createBooking,
} from "../../lib/authApi";

export default function ItineraryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({
    status: "loading",
    itinerary: null,
    itineraryId: id,
    error: "",
  });
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [modifications, setModifications] = useState("");
  const [savingDays, setSavingDays] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [bookingBusy, setBookingBusy] = useState(false);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    if (!id) return undefined;
    const controller = new AbortController();
    setState({ status: "loading", itinerary: null, itineraryId: id, error: "" });

    fetchItineraryById(id)
      .then((data) => {
        if (controller.signal.aborted) return;
        const record = data.itinerary || data;
        const itinerary = unwrapItineraryRecord(record);
        if (!itinerary) {
          throw new Error("That itinerary could not be loaded.");
        }
        setState({ status: "ready", itinerary, itineraryId: id, error: "" });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          itinerary: null,
          itineraryId: id,
          error: err instanceof Error ? err.message : "We couldn't load this itinerary.",
        });
      });

    return () => controller.abort();
  }, [id]);

  const handleDownloadPdf = useCallback(async () => {
    try {
      const itin = state.itinerary;
      if (!id) {
        alert("Itinerary ID not available. Please generate the itinerary again.");
        return;
      }
      const response = await downloadItineraryPdf(id);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${String(itin?.destination || "trip").replace(/\s+/g, "-")}-itinerary.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download PDF: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }, [id, state.itinerary]);

  const handleRegenerate = useCallback(async () => {
    if (!id) return;
    const text = modifications.trim();
    if (text.length < 10) {
      alert("Please describe the changes in at least 10 characters.");
      return;
    }

    setRegenerateOpen(false);
    setState((prev) => ({ ...prev, status: "loading", error: "" }));
    try {
      const data = await regenerateItinerary(id, text);
      const itinerary = unwrapItineraryRecord(data.itinerary || data);
      setModifications("");
      setState({ status: "ready", itinerary, itineraryId: id, error: "" });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to regenerate itinerary.",
      }));
    }
  }, [id, modifications]);

  const handleSaveDays = useCallback(
    async (days) => {
      if (!id) return;
      setSavingDays(true);
      try {
        const data = await updateItinerary(id, { days });
        const itinerary = unwrapItineraryRecord(data.itinerary || data);
        setState((prev) => ({ ...prev, itinerary, status: "ready", error: "" }));
      } catch (err) {
        alert(err instanceof Error ? err.message : "We couldn't save that day's edits.");
      } finally {
        setSavingDays(false);
      }
    },
    [id],
  );

  const handleShare = useCallback(async () => {
    if (!id) return;
    const url = `${window.location.origin}/share/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice("Share link copied.");
    } catch {
      setShareNotice(url);
    }
    setTimeout(() => setShareNotice(""), 3500);
  }, [id]);

  const handleBook = useCallback(async () => {
    const itin = state.itinerary;
    if (!itin || !id) return;
    setBookingBusy(true);
    try {
      await createBooking({
        type: "package",
        title: `${itin.destination} itinerary`,
        destination: itin.destination,
        startDate: itineraryDate(itin.startDate),
        endDate: itineraryDate(itin.endDate),
        guests: 1,
        totalAmount: safeNumber(itin.budgetBreakdown?.total ?? itin.totalBudget),
        currency: "INR",
        notes: "Created from a generated itinerary.",
        metadata: { itineraryId: id },
      });
      setBooked(true);
      navigate("/bookings");
    } catch (err) {
      alert(err instanceof Error ? err.message : "We couldn't create that booking.");
    } finally {
      setBookingBusy(false);
    }
  }, [id, navigate, state.itinerary]);

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#133C55] flex flex-col justify-between">
      <div>
        <UserNavbar />
        <main className="pt-28 px-4 sm:px-8 pb-16 max-w-7xl mx-auto w-full">
          <Link
            to="/bookings"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#2563EB] transition-colors mb-6"
          >
            <ArrowLeft size={15} /> Back to My Itineraries
          </Link>
          <ItineraryResults
            status={state.status}
            itinerary={state.itinerary}
            error={state.error}
            onDownloadPdf={handleDownloadPdf}
            onRegenerate={() => setRegenerateOpen(true)}
            onPlanAnother={() => navigate("/plan")}
            onSaveDays={handleSaveDays}
            savingDays={savingDays}
            onShare={handleShare}
            shareNotice={shareNotice}
            onBook={handleBook}
            bookingBusy={bookingBusy}
            booked={booked}
            onExportIcs={() => downloadItineraryIcs(state.itinerary)}
            loadingTitle="Loading your itinerary..."
            loadingSubtitle="Fetching the saved plan for this trip."
          />
        </main>
      </div>
      <Footer />

      {regenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Change this itinerary</h2>
              <button type="button" onClick={() => setRegenerateOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              Describe what to change — pace, budget, food, skipped sights, extra rest days.
            </p>
            <textarea
              value={modifications}
              onChange={(e) => setModifications(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
              placeholder="e.g. Swap Day 2 for a slower food walk and drop the museum."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRegenerateOpen(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function itineraryDate(value) {
  if (!value) return undefined;
  return String(value).slice(0, 10);
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
