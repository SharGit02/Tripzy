import { describe, expect, it } from "vitest";

import { __budgetInternals } from "./itinerary.service.js";
import { computeLiveBudget } from "./itinerary.liveBudget.js";

const { buildBudget, buildBudgetVerdict, roundUpToSuggestion, recalculateBudgetTotal } = __budgetInternals;

/*
 * The budget is the one number a traveler checks with a calculator, and every
 * bug fixed here was silent rather than loud:
 *
 * - the stay line summed EVERY shortlisted hotel instead of the one you book
 *   (8 hotels since the SerpApi change, so an 8x overcharge),
 * - the transport line summed mutually exclusive intercity options, so a trip
 *   was charged for the flight AND the train AND the bus,
 * - no multiplication by rooms or party size anywhere,
 * - and when the user supplied a budget, the breakdown was fabricated by
 *   splitting it 40/25/15/10 instead of costing the trip, which is why a total
 *   could match the requested budget while none of the line items were real.
 */

const input: any = {
    destination: "Srinagar",
    startDate: "2026-11-01",
    endDate: "2026-11-05", // 5 days, 4 nights
    adults: 2,
    children: 0,
    rooms: 1,
    accommodationType: "standard",
    preferredTransport: "flight",
    tripType: "couple",
    interests: [],
    wheelchairAccessible: false,
    travelStyle: "balanced",
};

const quotedStay = {
    name: "Houseboat on Dal Lake",
    source: "serpapi",
    pricePerNight: 3000,
    totalPrice: 12000,
};

const alternativeStay = {
    name: "Boulevard hotel",
    source: "serpapi",
    pricePerNight: 9000,
    totalPrice: 36000,
};

const flight = { type: "flight", estimatedCost: 7000 };
const train = { type: "train", estimatedCost: 1800 };
const localCab = { type: "cab", estimatedCost: 2500 };

const days = [
    {
        activities: [
            { type: "visit", cost: 500 },
            { type: "meal", cost: 1200 },
        ],
    },
];

describe("buildBudget", () => {
    it("costs one stay, not the whole shortlist", () => {
        const one = buildBudget({}, days, [quotedStay], [flight], input);
        const many = buildBudget(
            {},
            days,
            [quotedStay, alternativeStay, alternativeStay],
            [flight],
            input,
        );

        expect(one.accommodation).toBe(12000);
        expect(many.accommodation).toBe(one.accommodation);
    });

    it("multiplies the stay by rooms", () => {
        const twoRooms = buildBudget({}, days, [quotedStay], [flight], {
            ...input,
            rooms: 2,
        });

        expect(twoRooms.accommodation).toBe(24000);
    });

    it("falls back to the nightly rate when there is no window total", () => {
        const noTotal = buildBudget(
            {},
            days,
            [{ ...quotedStay, totalPrice: undefined }],
            [flight],
            input,
        );

        // 3000 per night x 4 nights x 1 room
        expect(noTotal.accommodation).toBe(12000);
    });

    it("charges one intercity leg per person, never every alternative", () => {
        const costed = buildBudget({}, days, [quotedStay], [flight, train], input);

        // 7000 x 2 travelers, and nothing for the train we are not taking.
        expect(costed.transport).toBe(14000);
    });

    it("picks the leg matching the preferred transport", () => {
        const byTrain = buildBudget({}, days, [quotedStay], [flight, train], {
            ...input,
            preferredTransport: "train",
        });

        expect(byTrain.transport).toBe(3600);
    });

    it("adds local transport once for the whole group", () => {
        const costed = buildBudget(
            {},
            days,
            [quotedStay],
            [flight, localCab],
            input,
        );

        expect(costed.transport).toBe(14000 + 2500);
    });

    it("estimates the intercity fare when the model did not price it", () => {
        const unpriced = buildBudget(
            {},
            days,
            [quotedStay],
            [{ type: "flight", estimatedCost: 0 }],
            input,
        );

        // Floor of 6000 per person rather than dropping flights from the trip.
        expect(unpriced.transport).toBe(12000);
        expect(unpriced._intercityEstimated).toBe(true);
    });

    it("flags a quoted stay as quoted and an AI stay as not", () => {
        expect(
            buildBudget({}, days, [quotedStay], [flight], input)
                ._accommodationQuoted,
        ).toBe(true);

        expect(
            buildBudget({}, days, [{ ...quotedStay, source: "ai" }], [flight], input)
                ._accommodationQuoted,
        ).toBe(false);
    });

    it("always has line items that add up to the total", () => {
        const costed = buildBudget({}, days, [quotedStay], [flight], input);

        expect(
            costed.accommodation +
                costed.food +
                costed.transport +
                costed.activities +
                costed.miscellaneous,
        ).toBe(costed.total);
    });

    it("ignores a requested budget when costing the trip", () => {
        const withBudget = buildBudget({}, days, [quotedStay], [flight], {
            ...input,
            budget: 20000,
        });
        const withoutBudget = buildBudget({}, days, [quotedStay], [flight], input);

        expect(withBudget.total).toBe(withoutBudget.total);
    });

    it("ignores a budget breakdown the model made up", () => {
        const inflated = buildBudget(
            {
                budgetBreakdown: {
                    accommodation: 99999,
                    food: 99999,
                    transport: 99999,
                    activities: 99999,
                    miscellaneous: 99999,
                    total: 499995,
                },
            },
            days,
            [quotedStay],
            [flight],
            input,
        );

        expect(inflated.total).toBe(
            buildBudget({}, days, [quotedStay], [flight], input).total,
        );
    });

    it("survives an itinerary with no stay and no transport", () => {
        const empty = buildBudget({}, [], [], [], input);

        expect(empty.accommodation).toBe(0);
        expect(empty.total).toBeGreaterThan(0); // food floor still applies
        expect(Number.isFinite(empty.total)).toBe(true);
    });
});

describe("buildBudgetVerdict", () => {
    const costed = buildBudget({}, days, [quotedStay], [flight], input);
    // 12000 stay + 14000 transport + 1200 food + 500 activities + 5% = 29085
    const total = costed.total;

    it("reports the gap and a workable budget when over", () => {
        const verdict = buildBudgetVerdict(costed, { ...input, budget: 20000 });

        expect(verdict.withinBudget).toBe(false);
        expect(verdict.requestedBudget).toBe(20000);
        expect(verdict.estimatedTotal).toBe(total);
        expect(verdict.difference).toBe(total - 20000);
        expect(verdict.suggestedBudget).toBeGreaterThanOrEqual(total);
        expect(verdict.notes.join(" ")).toMatch(/more than your preferred budget/);
    });

    it("reports the headroom when under, and suggests nothing", () => {
        const verdict = buildBudgetVerdict(costed, { ...input, budget: 90000 });

        expect(verdict.withinBudget).toBe(true);
        expect(verdict.difference).toBe(total - 90000);
        expect(verdict.difference).toBeLessThan(0);
        expect(verdict.suggestedBudget).toBeNull();
        expect(verdict.notes.join(" ")).toMatch(/under your preferred budget/);
    });

    it("treats an exactly-on-budget trip as within budget", () => {
        const verdict = buildBudgetVerdict(costed, { ...input, budget: total });

        expect(verdict.withinBudget).toBe(true);
        expect(verdict.difference).toBe(0);
        expect(verdict.suggestedBudget).toBeNull();
    });

    it("has no verdict to give when no budget was set", () => {
        const verdict = buildBudgetVerdict(costed, input);

        expect(verdict.requestedBudget).toBeNull();
        expect(verdict.difference).toBeNull();
        expect(verdict.suggestedBudget).toBeNull();
        expect(verdict.withinBudget).toBe(true);
    });

    it("hedges an estimated intercity fare in the notes", () => {
        const estimated = buildBudget(
            {},
            days,
            [quotedStay],
            [{ type: "flight", estimatedCost: 0 }],
            input,
        );
        const verdict = buildBudgetVerdict(estimated, input);

        expect(verdict.intercityFareEstimated).toBe(true);
        expect(verdict.notes.join(" ")).toMatch(/not a quote/);
    });

    it("keeps estimatedTotal equal to the breakdown total", () => {
        const verdict = buildBudgetVerdict(costed, { ...input, budget: 1000 });

        expect(verdict.estimatedTotal).toBe(costed.total);
    });
});

describe("recalculateBudgetTotal", () => {
    // regenerateItinerary used to skip this step entirely and trust the
    // model's own `budgetBreakdown.total` verbatim - the exact "parts don't
    // add up to the total" bug class this guards against, now shared by both
    // the direct-generation and regeneration paths.
    it("recomputes total as the sum of its own clamped categories, ignoring whatever total the model supplied", () => {
        const itinerary: any = {
            budgetBreakdown: {
                accommodation: 12000,
                food: 1200,
                transport: 14000,
                activities: 500,
                miscellaneous: 1385,
                total: 999999, // the model's own (wrong) total - must be ignored
            },
            accommodations: [{ source: "serpapi" }],
        };

        recalculateBudgetTotal(itinerary, input);

        expect(itinerary.budgetBreakdown.total).toBe(12000 + 1200 + 14000 + 500 + 1385);
    });

    it("clamps a negative category to zero before summing", () => {
        const itinerary: any = {
            budgetBreakdown: { accommodation: -500, food: 1000, transport: 0, activities: 0, miscellaneous: 0 },
            accommodations: [],
        };

        recalculateBudgetTotal(itinerary, input);

        expect(itinerary.budgetBreakdown.accommodation).toBe(0);
        expect(itinerary.budgetBreakdown.total).toBe(1000);
    });

    it("rebuilds the verdict against the corrected total, not a stale one", () => {
        const itinerary: any = {
            budgetBreakdown: { accommodation: 12000, food: 1200, transport: 14000, activities: 500, miscellaneous: 1385 },
            budgetVerdict: { estimatedTotal: 1, withinBudget: true, intercityFareEstimated: false },
            accommodations: [{ source: "serpapi" }],
        };

        recalculateBudgetTotal(itinerary, { ...input, budget: 20000 });

        expect(itinerary.budgetVerdict.estimatedTotal).toBe(itinerary.budgetBreakdown.total);
        expect(itinerary.budgetVerdict.withinBudget).toBe(false);
    });
});

describe("roundUpToSuggestion", () => {
    it("rounds up to something a person would type", () => {
        expect(roundUpToSuggestion(29085)).toBe(30000);
        expect(roundUpToSuggestion(12300)).toBe(13000);
        expect(roundUpToSuggestion(143000)).toBe(150000);
    });

    it("never rounds down and never goes negative", () => {
        expect(roundUpToSuggestion(30000)).toBe(30000);
        expect(roundUpToSuggestion(0)).toBe(0);
        expect(roundUpToSuggestion(-5)).toBe(0);
    });
});

/*
 * The receipt on screen and the receipt in the PDF are now the same number,
 * recomputed from the ticks rather than frozen at generation time. These cases
 * are the ones that used to differ.
 */
describe("computeLiveBudget", () => {
    const stored: any = {
        totalDays: 5, // 4 nights
        budgetBreakdown: {
            accommodation: 40000,
            food: 12000,
            transport: 12000,
            activities: 3000,
            miscellaneous: 3350,
            total: 70350,
            currency: "INR",
        },
        budgetExplain: {
            people: 2,
            rooms: 1,
            transport: { local: 1000 },
            miscellaneous: { rate: 0.05 },
        },
        accommodations: [
            { name: "Pricey Palace", pricePerNight: 10000 },
            { name: "Modest Inn", pricePerNight: 4000 },
        ],
        days: [{ day: 1, activities: [{ cost: 2000 }, { cost: 1000 }] }],
        selections: { excluded: [], flights: [], trains: [], buses: [] },
    };

    it("prices the first non-excluded stay, not the generation-time one", () => {
        const swapped = computeLiveBudget({
            ...stored,
            selections: { ...stored.selections, excluded: ["hotel:0"] },
        });
        expect(swapped.accommodation).toBe(16000); // 4000 x 4 nights x 1 room
    });

    it("falls back to the stored figure when every stay is unticked", () => {
        const none = computeLiveBudget({
            ...stored,
            selections: { ...stored.selections, excluded: ["hotel:0", "hotel:1"] },
        });
        expect(none.accommodation).toBe(40000);
    });

    it("multiplies a ticked fare by party size and adds local travel", () => {
        const ticked = computeLiveBudget({
            ...stored,
            selections: { ...stored.selections, flights: [{ predictedFare: 2500 }] },
        });
        expect(ticked.transport).toBe(6000); // 2500 x 2 travellers + 1000 local
    });

    it("keeps a single fare when party size is unknown (pre-budgetExplain trips)", () => {
        const legacy = computeLiveBudget({
            ...stored,
            budgetExplain: undefined,
            selections: { ...stored.selections, trains: [{ predictedFare: 2500 }] },
        });
        expect(legacy.transport).toBe(2500);
    });

    it("drops unticked activities", () => {
        const dropped = computeLiveBudget({
            ...stored,
            selections: { ...stored.selections, excluded: ["activity:1:0"] },
        });
        expect(dropped.activities).toBe(1000);
    });

    it("recomputes miscellaneous and the total off the live lines", () => {
        const live = computeLiveBudget({
            ...stored,
            selections: { ...stored.selections, excluded: ["hotel:0"] },
        });
        // 16000 stay + 12000 food + 12000 transport + 3000 activities
        expect(live.miscellaneous).toBe(2150);
        expect(live.total).toBe(45150);
        expect(live.total).toBe(
            live.accommodation + live.food + live.transport + live.activities + live.miscellaneous,
        );
    });

    it("matches the stored breakdown when nothing has been ticked or unticked", () => {
        const untouched = computeLiveBudget(stored);
        expect(untouched.accommodation).toBe(40000); // Pricey Palace, 10000 x 4
        expect(untouched.transport).toBe(12000); // stored: no fare ticked
    });
});
