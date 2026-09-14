const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthIndex(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { year: date.getFullYear(), month: date.getMonth() };
}

function sumByMonth(rows, year, getDate, getAmount) {
  const data = Array(12).fill(0);
  for (const row of rows) {
    const when = monthIndex(getDate(row));
    if (!when || when.year !== year) continue;
    data[when.month] += Number(getAmount(row)) || 0;
  }
  return data;
}

function avgNonZero(data) {
  const values = data.filter((n) => n > 0);
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function pctChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildTravelCostView({ itineraries = [], fareHistory = [], bookings = [] }) {
  const year = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const prevMonth = currentMonth === 0 ? 0 : currentMonth - 1;

  const itinerarySpend = sumByMonth(
    itineraries,
    year,
    (row) => row.startDate || row.createdAt,
    (row) => row.totalBudget,
  );
  const fareSpend = sumByMonth(
    fareHistory,
    year,
    (row) => row.createdAt || row.searchStartDate,
    (row) => row.bestPredictedFare,
  );
  const bookingSpend = sumByMonth(
    bookings,
    year,
    (row) => row.startDate || row.createdAt,
    (row) => row.totalAmount,
  );

  const series = [
    { mode: "Itineraries", color: "#2563EB", data: itinerarySpend },
    { mode: "Fare searches", color: "#7c3aed", data: fareSpend },
    { mode: "Bookings", color: "#16a34a", data: bookingSpend },
  ];

  const transformed = MONTHS.map((month, i) => ({
    month,
    Itineraries: itinerarySpend[i],
    "Fare searches": fareSpend[i],
    Bookings: bookingSpend[i],
  }));

  const itineraryTotal = itinerarySpend.reduce((a, b) => a + b, 0);
  const fareTotal = fareSpend.reduce((a, b) => a + b, 0);
  const bookingTotal = bookingSpend.reduce((a, b) => a + b, 0);
  const empty = itineraryTotal + fareTotal + bookingTotal === 0;

  const overview = [
    {
      mode: "Itineraries",
      avgCost: avgNonZero(itinerarySpend),
      change: pctChange(itinerarySpend[currentMonth], itinerarySpend[prevMonth]),
    },
    {
      mode: "Fare searches",
      avgCost: avgNonZero(fareSpend),
      change: pctChange(fareSpend[currentMonth], fareSpend[prevMonth]),
    },
    {
      mode: "Bookings",
      avgCost: avgNonZero(bookingSpend),
      change: pctChange(bookingSpend[currentMonth], bookingSpend[prevMonth]),
    },
  ];

  const cheapest = overview.reduce((best, item) => (item.avgCost && item.avgCost < best.avgCost ? item : best), {
    mode: "Itineraries",
    avgCost: Infinity,
  });

  return {
    year,
    months: MONTHS,
    series,
    transformed,
    overview,
    insight: empty
      ? "Plan a trip, search fares, or book from an itinerary to see real numbers here."
      : `This year: ₹${itineraryTotal.toLocaleString("en-IN")} in planned itineraries, ₹${fareTotal.toLocaleString("en-IN")} in fare searches, ₹${bookingTotal.toLocaleString("en-IN")} in bookings.`,
    smartPick: empty
      ? "Your dashboard fills in from itinerary and fare history — no sample data."
      : cheapest.avgCost === Infinity
        ? "Keep planning to compare itinerary budgets with fare searches."
        : `${cheapest.mode} currently show the lowest average monthly amount.`,
    empty,
  };
}

export function uniqueDestinations(itineraries = [], bookings = []) {
  const places = new Set();
  for (const row of itineraries) {
    if (row.destination) places.add(String(row.destination).toLowerCase());
  }
  for (const row of bookings) {
    if (row.destination) places.add(String(row.destination).toLowerCase());
  }
  return places.size;
}
