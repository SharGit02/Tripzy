/**
 * Mock travel cost data — shaped exactly like the future ML backend response.
 * When the backend is ready, replace `fetchTravelCosts()` in the chart component
 * with a real API call: GET /api/travel-costs?year=YYYY
 * The shape of the response should match this object.
 */
export const TRAVEL_COSTS_MOCK = {
  2026: {
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
    series: [
      {
        mode: "Train",
        color: "#2563EB",
        data: [2100, 2050, 2200, 2150, 2800, 2400, 2300],
      },
      {
        mode: "Bus",
        color: "#16a34a",
        data: [4200, 4100, 4300, 4250, 4600, 4400, 4350],
      },
      {
        mode: "Flight",
        color: "#7c3aed",
        data: [5800, 5900, 6100, 6000, 9200, 7500, 6200],
      },
    ],
    insight:
      "Flight prices increased in May due to holidays. Train remains the most economical option.",
    overview: [
      { mode: "Train", icon: "train", avgCost: 2000, change: -12 },
      { mode: "Bus", icon: "bus", avgCost: 4000, change: 8 },
      { mode: "Flight", icon: "plane", avgCost: 6000, change: 15 },
    ],
    smartPick: "Train looks like the best-value option this month.",
  },
  2025: {
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
    series: [
      {
        mode: "Train",
        color: "#2563EB",
        data: [1900, 1850, 2000, 2100, 2400, 2200, 2100],
      },
      {
        mode: "Bus",
        color: "#16a34a",
        data: [3800, 3700, 4000, 3900, 4200, 4100, 4000],
      },
      {
        mode: "Flight",
        color: "#7c3aed",
        data: [5200, 5300, 5600, 5500, 8500, 6800, 5700],
      },
    ],
    insight:
      "Peak summer travel drove Flight prices up 60% in May. Bus offered the best mid-range value.",
    overview: [
      { mode: "Train", icon: "train", avgCost: 1900, change: -5 },
      { mode: "Bus", icon: "bus", avgCost: 3800, change: 3 },
      { mode: "Flight", icon: "plane", avgCost: 5500, change: 12 },
    ],
    smartPick: "Bus offers the best value for medium distances this year.",
  },
};

/**
 * Simulates an async API call — swap this for a real fetch in the future.
 * Usage: const data = await fetchTravelCosts(2026);
 */
export async function fetchTravelCosts(year = 2026) {
  // TODO: Replace with → return fetch(`/api/travel-costs?year=${year}`).then(r => r.json())
  return new Promise((resolve) =>
    setTimeout(() => resolve(TRAVEL_COSTS_MOCK[year] ?? TRAVEL_COSTS_MOCK[2026]), 400)
  );
}
