import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, TriangleAlert, Calendar, MapPin } from "lucide-react";
import UserNavbar from "../../components/layout/UserNavbar";
import { fetchFlightFarePredictionById } from "../../lib/authApi";
import FarePricesSection from "./components/FarePricesSection";

const INITIAL_STATE = { status: "loading", prediction: null, error: "" };

function formatDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function TripPage() {
    const { id } = useParams();
    const [{ status, prediction, error }, setState] = useState(INITIAL_STATE);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!id) return undefined;
        const controller = new AbortController();

        fetchFlightFarePredictionById(id)
            .then((data) => {
                if (controller.signal.aborted) return;
                setState({ status: "ready", prediction: data.prediction, error: "" });
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                setState({ status: "error", prediction: null, error: err.message || "Unable to load this trip." });
            });

        return () => controller.abort();
    }, [id, reloadKey]);

    const retry = useCallback(() => {
        setState(INITIAL_STATE);
        setReloadKey((k) => k + 1);
    }, []);

    return (
        <div className="min-h-screen bg-[#F7F9FC] text-[#133C55]">
            <UserNavbar />
            <main className="pt-28 px-6 pb-16 max-w-5xl mx-auto">
                <Link
                    to="/catalog"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#2563EB] transition-colors mb-4"
                >
                    <ArrowLeft size={15} />
                    Back to search
                </Link>

                {status === "ready" && prediction && (
                    <div className="mb-8">
                        <h1 className="text-3xl font-extrabold mb-2 flex items-center gap-2 flex-wrap">
                            <MapPin size={22} className="text-[#2563EB]" />
                            {prediction.origin} → {prediction.destination}
                        </h1>
                        <p className="text-[#386FA4] flex items-center gap-1.5">
                            <Calendar size={15} />
                            Scanned from {formatDate(prediction.searchStartDate)} · {prediction.windowDays} days
                        </p>
                    </div>
                )}

                {status === "loading" && (
                    <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-8" aria-busy="true">
                        <div className="h-6 w-64 rounded bg-slate-100 animate-pulse mb-6" />
                        <div className="h-24 rounded-2xl bg-slate-100 animate-pulse mb-4" />
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse mb-2" />
                        ))}
                    </div>
                )}

                {status === "error" && (
                    <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-8 text-center">
                        <TriangleAlert size={26} className="mx-auto mb-2 text-amber-400" />
                        <p className="text-sm font-semibold text-[#0f2442] mb-1">Couldn't load this trip</p>
                        <p className="text-sm text-slate-500 mb-4">{error}</p>
                        <button
                            type="button"
                            onClick={retry}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-bold text-[#0f2442] transition-colors"
                        >
                            <RefreshCw size={12} />
                            Try again
                        </button>
                    </div>
                )}

                {status === "ready" && (
                    <section>
                        <h2 className="text-lg font-bold text-[#0f2442] mb-3">Fare prices</h2>
                        <FarePricesSection prediction={prediction} />
                    </section>
                )}
            </main>
        </div>
    );
}
