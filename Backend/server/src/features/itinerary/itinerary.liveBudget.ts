/**
 * The costed trip as it stands AFTER the traveler's ticks, recomputed from the
 * stored itinerary document.
 *
 * `budgetBreakdown` is written once at generation time, from the AI's first
 * hotel and a typical intercity fare. The traveler then picks a different
 * stay, ticks a predicted flight, drops an activity — and none of that reaches
 * the stored figure. The results page has always recomputed it on screen; this
 * module exists so the PDF prints the same number instead of the generation-
 * time one.
 *
 * Deliberately a pure function of the stored document: no DB, no network, no
 * imports from itinerary.service (which imports the PDF service, so the
 * dependency would be a cycle).
 *
 * KEEP IN SYNC with `liveBudget` in Client/src/pages/Itinerary/
 * ItineraryResults.jsx - same rules, same fallbacks, same key strings. If the
 * two drift, the screen and the PDF disagree about what the trip costs, which
 * is exactly the bug this module was added to fix.
 */

export type LiveBudget = {
    accommodation: number;
    food: number;
    transport: number;
    activities: number;
    miscellaneous: number;
    total: number;
    currency: string;
};

function num(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

export function computeLiveBudget(itinerary: any): LiveBudget {
    const stored = itinerary?.budgetBreakdown || {};
    const currency = String(stored.currency || "INR");

    const selections = itinerary?.selections || {};
    const excluded = new Set<string>(
        Array.isArray(selections.excluded) ? selections.excluded.map(String) : [],
    );

    const explain = itinerary?.budgetExplain || null;
    const nights = Math.max(1, num(itinerary?.totalDays) - 1 || 1);
    const rooms = Math.max(1, num(explain?.rooms) || 1);
    const people = num(explain?.people);

    // One stay, not every ticked one: the traveler may tick several hotels to
    // compare them in the export, but the trip is still one booking - the same
    // reason costAccommodation only ever prices accommodations[0].
    const accommodations: any[] = Array.isArray(itinerary?.accommodations)
        ? itinerary.accommodations
        : [];
    const firstHotel = accommodations.filter(
        (_acc, index) => !excluded.has(`hotel:${index}`),
    )[0];

    const accommodation = firstHotel
        ? (num(firstHotel.totalPrice) || num(firstHotel.pricePerNight) * nights) * rooms
        : num(stored.accommodation);

    /*
     * Predicted fares price ONE seat, which is how the server costs the
     * intercity leg too, so a ticked fare multiplies by party size. Without a
     * known party size (itineraries saved before budgetExplain existed) it
     * stays a single fare rather than inventing a multiplier.
     */
    const chosenFares: any[] = [
        ...(Array.isArray(selections.flights) ? selections.flights : []),
        ...(Array.isArray(selections.trains) ? selections.trains : []),
        ...(Array.isArray(selections.buses) ? selections.buses : []),
    ];
    const seats = people || 1;
    const local = num(explain?.transport?.local);
    const transport =
        chosenFares.length > 0
            ? chosenFares.reduce((sum, fare) => sum + num(fare?.predictedFare) * seats, 0) + local
            : num(stored.transport);

    const days: any[] = Array.isArray(itinerary?.days) ? itinerary.days : [];
    const activities = days.reduce((sum, day) => {
        const dayActivities: any[] = Array.isArray(day?.activities) ? day.activities : [];
        return (
            sum +
            dayActivities.reduce((daySum, activity, index) => {
                if (excluded.has(`activity:${day.day}:${index}`)) return daySum;
                return daySum + num(activity?.cost);
            }, 0)
        );
    }, 0);

    // No per-item checkbox ties to a meal, so food stays as costed.
    const food = num(stored.food);

    // Recomputed, never carried: the stored figure is 5% of the generation-time
    // lines and goes stale the moment a different hotel or fare is ticked.
    const rate = num(explain?.miscellaneous?.rate) || 0.05;
    const miscellaneous = Math.round((accommodation + food + transport + activities) * rate);

    return {
        accommodation: Math.round(accommodation),
        food: Math.round(food),
        transport: Math.round(transport),
        activities: Math.round(activities),
        miscellaneous,
        total: Math.round(accommodation + food + transport + activities + miscellaneous),
        currency,
    };
}
