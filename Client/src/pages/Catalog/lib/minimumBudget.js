/**
 * Pre-generation floor estimate for a trip, used to warn the traveller when
 * their preferred budget cannot physically cover the trip they described.
 *
 * This is a FLOOR, not a quote: it uses the cheapest end of each band the
 * server's prompt already quotes to the model
 * (see `itinerary.ai.service.ts` -> accommodationBudgetMap, and the
 * people x days x 1200 food fallback in `itinerary.service.ts`), so a budget
 * at or above this number is at least plausible. The real total comes back
 * with the generated itinerary.
 *
 * ponytail: no distance lookup — intercity travel is a flat per-person floor
 * per mode. If it needs to be route-aware, feed it the flight-fare predictor
 * (`fetchFlightFarePrediction`) instead of INTERCITY_FLOOR.
 */

/** Cheapest end of each accommodation band, per room per night. */
const NIGHTLY_FLOOR = {
  budget: 1000,
  standard: 3000,
  premium: 7000,
  luxury: 15000,
};

/** Cheapest realistic round trip per person, by preferred mode. */
const INTERCITY_FLOOR = {
  flight: 6000,
  train: 1600,
  bus: 1200,
  self_drive: 3500,
};

/** Per person per day: food floor, then local transport + entry fees floor. */
const FOOD_PER_PERSON_DAY = 600;
const LOCAL_PER_PERSON_DAY = 400;

/** Matches the server's 5% miscellaneous line. */
const MISC_RATE = 0.05;

export function tripDayCount(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return days > 0 ? days : 0;
}

/**
 * @returns {null | {total: number, days: number, nights: number, people: number,
 *   breakdown: {label: string, amount: number}[]}}
 *   null when there is not enough input yet to estimate anything.
 */
export function estimateMinimumBudget({
  startDate,
  endDate,
  adults = 2,
  children = 0,
  rooms = 1,
  accommodationType = "standard",
  preferredTransport = "flight",
} = {}) {
  const days = tripDayCount(startDate, endDate);
  if (days === 0) return null;

  const people = Math.max(1, Number(adults) || 0) + Math.max(0, Number(children) || 0);
  const nights = Math.max(1, days - 1);
  const roomCount = Math.max(1, Number(rooms) || 1);

  const nightly = NIGHTLY_FLOOR[accommodationType] ?? NIGHTLY_FLOOR.standard;
  const intercity = INTERCITY_FLOOR[preferredTransport] ?? INTERCITY_FLOOR.flight;

  const stay = nightly * roomCount * nights;
  const travel = intercity * people;
  const food = FOOD_PER_PERSON_DAY * people * days;
  const local = LOCAL_PER_PERSON_DAY * people * days;
  const miscellaneous = Math.round((stay + travel + food + local) * MISC_RATE);

  const total = stay + travel + food + local + miscellaneous;

  return {
    total,
    days,
    nights,
    people,
    breakdown: [
      { label: `Stay (${roomCount} room${roomCount > 1 ? "s" : ""} x ${nights} night${nights > 1 ? "s" : ""})`, amount: stay },
      { label: `Travel to and back (${people} traveller${people > 1 ? "s" : ""})`, amount: travel },
      { label: "Food", amount: food },
      { label: "Local transport and entry fees", amount: local },
      { label: "Buffer", amount: miscellaneous },
    ],
  };
}

/** Rounds up to a clean figure a person would actually type. */
export function roundUpToSuggestion(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const step = amount >= 100000 ? 10000 : amount >= 20000 ? 5000 : 1000;
  return Math.ceil(amount / step) * step;
}

export function formatInr(amount) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
