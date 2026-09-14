/**
 * Present saved itinerary rows in the same shape the generate endpoint returns:
 * a display itinerary object plus itineraryId. The client should not need
 * to unwrap itineraryData.
 */
export function presentItinerary(row: any) {
    if (!row) return null;
    const data =
        row.itineraryData && typeof row.itineraryData === "object"
            ? row.itineraryData
            : {};
    const startDate = toDateString(data.startDate || row.startDate);
    const endDate = toDateString(data.endDate || row.endDate);

    return {
        ...data,
        id: row.id,
        title: row.title || data.title,
        destination: data.destination || row.destination,
        startDate,
        endDate,
        totalDays: Number(data.totalDays || row.totalDays) || undefined,
        overview: data.overview || "",
        budgetBreakdown: data.budgetBreakdown,
        accommodations: data.accommodations || [],
        placesToVisit: data.placesToVisit || [],
        days: data.days || [],
        tips: data.tips || [],
        status: row.status || data.status,
        currency: row.currency || data.currency || "INR",
        totalBudget: toNumber(row.totalBudget) ?? data.budgetBreakdown?.total,
    };
}

export function presentItineraryListItem(row: any) {
    const presented = presentItinerary(row);
    return {
        id: presented?.id,
        title: presented?.title,
        destination: presented?.destination,
        startDate: presented?.startDate,
        endDate: presented?.endDate,
        status: presented?.status,
        totalBudget: presented?.totalBudget,
        totalDays: presented?.totalDays,
        currency: presented?.currency,
    };
}

function toDateString(value: unknown): string {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const text = String(value);
    return text.slice(0, 10);
}

function toNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}
