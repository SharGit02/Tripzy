/**
 * Self-check for the budget floor estimate. Run with:
 *   node src/pages/Catalog/lib/minimumBudget.test.js
 */
import assert from "node:assert/strict";
import {
  estimateMinimumBudget,
  roundUpToSuggestion,
  tripDayCount,
} from "./minimumBudget.js";

// Day counting is inclusive of both ends, like the payload validator.
assert.equal(tripDayCount("2026-11-01", "2026-11-05"), 5);
assert.equal(tripDayCount("2026-11-01", "2026-11-01"), 1);
assert.equal(tripDayCount("2026-11-05", "2026-11-01"), 0, "end before start is not a trip");
assert.equal(tripDayCount("", "2026-11-05"), 0);
assert.equal(tripDayCount("nonsense", "2026-11-05"), 0);

// Not enough input yet -> no estimate, so the UI shows no warning.
assert.equal(estimateMinimumBudget({}), null);

// A worked example, checked by hand:
//   5 days / 4 nights, 2 adults, 1 room, standard, flight
//   stay   3000 * 1 * 4            = 12000
//   travel 6000 * 2                = 12000
//   food    600 * 2 * 5            =  6000
//   local   400 * 2 * 5            =  4000
//   buffer 5% of 34000             =  1700
const trip = estimateMinimumBudget({
  startDate: "2026-11-01",
  endDate: "2026-11-05",
  adults: 2,
  children: 0,
  rooms: 1,
  accommodationType: "standard",
  preferredTransport: "flight",
});
assert.equal(trip.total, 35700);
assert.equal(trip.days, 5);
assert.equal(trip.nights, 4);
assert.equal(trip.people, 2);
assert.equal(
  trip.breakdown.reduce((sum, line) => sum + line.amount, 0),
  trip.total,
  "breakdown must sum to the total we show"
);

// A single-day trip still needs one night of stay, never zero.
assert.equal(
  estimateMinimumBudget({ startDate: "2026-11-01", endDate: "2026-11-01" }).nights,
  1
);

// More people and a pricier tier can only push the floor up.
const cheaper = estimateMinimumBudget({
  startDate: "2026-11-01",
  endDate: "2026-11-05",
  adults: 1,
  accommodationType: "budget",
  preferredTransport: "bus",
});
assert.ok(cheaper.total < trip.total);

const pricier = estimateMinimumBudget({
  startDate: "2026-11-01",
  endDate: "2026-11-05",
  adults: 4,
  children: 2,
  rooms: 3,
  accommodationType: "luxury",
  preferredTransport: "flight",
});
assert.ok(pricier.total > trip.total);

// Children count as people for food and travel, but not as extra rooms.
const withKids = estimateMinimumBudget({
  startDate: "2026-11-01",
  endDate: "2026-11-05",
  adults: 2,
  children: 2,
});
assert.ok(withKids.total > trip.total);

// Unknown tiers and modes fall back rather than producing NaN.
const unknown = estimateMinimumBudget({
  startDate: "2026-11-01",
  endDate: "2026-11-05",
  accommodationType: "penthouse",
  preferredTransport: "teleport",
});
assert.equal(unknown.total, trip.total);

// Suggestions round up to something typeable, and never down.
assert.equal(roundUpToSuggestion(35700), 40000);
assert.equal(roundUpToSuggestion(12300), 13000);
assert.equal(roundUpToSuggestion(4200), 5000);
assert.equal(roundUpToSuggestion(143000), 150000);
assert.equal(roundUpToSuggestion(0), 0);
assert.ok(roundUpToSuggestion(trip.total) >= trip.total);

console.log("minimumBudget: all checks passed");
