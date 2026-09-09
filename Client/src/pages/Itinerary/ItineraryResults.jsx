import { Loader2, AlertCircle, CheckCircle, Download, RotateCcw } from "lucide-react";

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

export default function ItineraryResults({
  status,
  itinerary,
  error,
  onDownloadPdf,
  onRegenerate,
  onPlanAnother,
}) {
  if (status === "loading") {
    return (
      <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-12 text-center max-w-md mx-auto">
        <Loader2 size={48} className="mx-auto mb-4 animate-spin text-[#2563EB]" />
        <h2 className="text-2xl font-bold mb-2">Creating your itinerary...</h2>
        <p className="text-slate-500">This may take a minute while we plan every detail.</p>
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

  const budgetBreakdown = itinerary?.budgetBreakdown ?? {
    accommodation: 0,
    food: 0,
    transport: 0,
    activities: 0,
    miscellaneous: 0,
    total: 0,
    currency: "INR",
  };

  const accommodations = itinerary.accommodations || [];
  const placesToVisit = itinerary.placesToVisit || [];
  const days = itinerary.days || [];
  const tips = itinerary.tips || [];

  return (
    <div className="rounded-3xl bg-white shadow-[0_18px_50px_rgba(15,36,66,0.08)] border border-slate-100 p-8 mb-8">
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

      <div className="prose prose-slate max-w-none">
        <h2 className="text-xl font-bold mb-3">Overview</h2>
        <p className="text-slate-600">{itinerary.overview}</p>

        <h2 className="text-xl font-bold mt-6 mb-3">
          Budget Breakdown ({formatCurrency(budgetBreakdown?.total)})
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { key: "accommodation", label: "Stay" },
            { key: "food", label: "Food" },
            { key: "transport", label: "Transport" },
            { key: "activities", label: "Activities" },
            { key: "miscellaneous", label: "Other" },
          ].map(({ key, label }) => (
            <div key={key} className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-2xl font-bold text-[#2563EB]">{formatCurrency(budgetBreakdown?.[key])}</p>
              <p className="text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mb-3">Accommodations</h2>
        <div className="space-y-3 mb-6">
          {accommodations.map((acc, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{acc.name}</p>
                <p className="text-sm text-slate-500">
                  {acc.type} · {acc.location} · ₹{Number(acc.pricePerNight || 0).toLocaleString()}/night
                </p>
              </div>
              <span className="text-[#2563EB] font-semibold">{acc.rating}★</span>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mb-3">Places to Visit</h2>
        <div className="space-y-3 mb-6">
          {placesToVisit.slice(0, 8).map((place, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{place.name}</p>
                <p className="text-sm text-slate-500">
                  {place.category} · {place.location} · {place.visitDurationHours}h
                </p>
              </div>
              <span className="text-[#2563EB] font-semibold">{place.rating}★</span>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mb-3">Day-by-Day Schedule</h2>
        <div className="space-y-4">
          {days.map((day) => (
            <div key={day.day} className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="font-semibold text-[#133C55]">
                  Day {day.day} · {formatDate(day.date)}
                </span>
                {day.theme && (
                  <span className="text-sm text-[#2563EB] bg-[#EBF3FE] px-2 py-1 rounded">{day.theme}</span>
                )}
              </div>
              <div className="p-4 space-y-2">
                {(day.activities || []).map((activity, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="w-16 text-slate-500 font-mono">{activity.time}</span>
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
                ))}
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
      </div>

      <div className="mt-8 flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={onDownloadPdf}
          className="flex-1 min-w-[160px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 transition-colors flex items-center justify-center gap-2"
        >
          <Download size={18} /> Download PDF
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          className="flex-1 min-w-[160px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold py-3 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw size={18} /> Regenerate
        </button>
      </div>

      {onPlanAnother && (
        <button
          type="button"
          onClick={onPlanAnother}
          className="mt-4 text-sm font-semibold text-slate-500 hover:text-[#2563EB] transition-colors"
        >
          Plan another trip
        </button>
      )}
    </div>
  );
}
