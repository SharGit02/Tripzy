import { z } from "zod";

// Absolute http(s) URLs only — see the usage note on imageUrl below.
const HttpUrlSchema = z
    .string()
    .refine(
        (value) => {
            try {
                const url = new URL(value);
                return url.protocol === "http:" || url.protocol === "https:";
            } catch {
                return false;
            }
        },
        { message: "Must be an absolute http(s) URL." },
    );

export const AccommodationTypeSchema = z.enum(["budget", "standard", "premium", "luxury"]);
export const TransportModeSchema = z.enum(["flight", "train", "bus", "self_drive"]);
export const TripTypeSchema = z.enum(["solo", "couple", "family", "friends"]);
export const InterestSchema = z.enum(["nature", "adventure", "beaches", "spiritual", "shopping", "food", "wildlife", "history"]);
export const TravelStyleSchema = z.enum(["relaxed", "balanced", "packed", "adventure"]);

export const ItineraryPlaceSchema = z.object({
    name: z.string(),
    description: z.string(),
    category: z.string(),
    location: z.string(),
    visitDurationHours: z.number().positive(),
    bestTimeToVisit: z.string(),
    priceRange: z.string().optional(),
    // http(s) only: this is rendered into an <img src> and an itinerary is
    // publicly shareable, so the same reasoning as the accommodation URLs
    // below applies. `imageSource` is an attribution page link.
    imageUrl: HttpUrlSchema.optional(),
    imageAuthor: z.string().optional(),
    imageLicense: z.string().optional(),
    imageSource: HttpUrlSchema.optional(),
});

// Accommodation options. Every field past `description` is optional and only
// populated for stays sourced from SerpApi's Google Hotels engine — an
// AI-suggested fallback stay has no rating, photo or booking link to carry, so
// requiring them would reject a perfectly usable itinerary.
export const ItineraryAccommodationSchema = z.object({
    name: z.string(),
    type: z.enum(["hotel", "flat", "hostel", "resort", "homestay"]),
    pricePerNight: z.number().positive(),
    currency: z.string().default("INR"),
    location: z.string(),
    amenities: z.array(z.string()),
    description: z.string(),
    // "serpapi" for a real, priced listing; "ai" for a generated suggestion.
    // The UI badges these differently so a user knows which prices are quotes.
    source: z.enum(["serpapi", "ai"]).optional(),
    totalPrice: z.number().nonnegative().optional(),
    rating: z.number().optional(),
    reviewsCount: z.number().optional(),
    locationRating: z.number().optional(),
    hotelClass: z.number().optional(),
    // http(s) only. These are rendered into `src`/`href` in the client and an
    // itinerary is publicly shareable, so a `javascript:` URL smuggled in
    // through a PATCH of itineraryData would be stored XSS. Validated here as
    // well as at the sink.
    imageUrl: HttpUrlSchema.optional(),
    thumbnailUrl: HttpUrlSchema.optional(),
    bookingLink: HttpUrlSchema.optional(),
    checkInTime: z.string().optional(),
    checkOutTime: z.string().optional(),
    reviewHighlights: z.array(z.string()).optional(),
});

/**
 * Which items the traveler ticked in the generated itinerary.
 *
 * Stored as EXCLUSIONS rather than inclusions so that anything added later — a
 * regenerated day, a new activity typed into the day editor — is selected by
 * default. An itinerary that has never been touched has no `selections` at all
 * and everything counts as selected, which keeps every pre-existing saved
 * itinerary rendering and exporting exactly as it did before.
 *
 * Keys are built by `selectionKey` in the client and read by the PDF service:
 *   hotel:<index>  place:<index>  activity:<day>:<index>  transport:<index>
 */
export const ItinerarySelectionsSchema = z.object({
    excluded: z.array(z.string()).default([]),
    // Flights are predicted client-side by the ML service and are not part of
    // the generated itinerary, so a chosen flight has to be stored in full to
    // reach the PDF at all. Unlike the rest, these are inclusions.
    flights: z
        .array(
            z.object({
                airline: z.string(),
                flightNumber: z.union([z.string(), z.number()]).optional(),
                date: z.string().optional(),
                dayOfWeek: z.string().optional(),
                predictedFare: z.number().nonnegative().optional(),
                origin: z.string().optional(),
                destination: z.string().optional(),
                // Which leg this choice belongs to. Optional for backward
                // compatibility with selections saved before outbound/return
                // split; an untagged entry is treated as outbound everywhere it
                // is read.
                direction: z.enum(["outbound", "return"]).optional(),
            }),
        )
        .default([]),
    // Same deal for trains: rail fares come from the ML service per request and
    // are not part of the generated document either. No train identity exists
    // in the rail model, so a chosen train is a route + date + fare.
    trains: z
        .array(
            z.object({
                origin: z.string().optional(),
                destination: z.string().optional(),
                date: z.string().optional(),
                dayOfWeek: z.string().optional(),
                predictedFare: z.number().nonnegative().optional(),
                direction: z.enum(["outbound", "return"]).optional(),
            }),
        )
        .default([]),
    // Same deal for buses: the RandomForest fare model predicts a route+date
    // fare with no operator/service identity either (see bus_predictor.py).
    buses: z
        .array(
            z.object({
                origin: z.string().optional(),
                destination: z.string().optional(),
                date: z.string().optional(),
                dayOfWeek: z.string().optional(),
                predictedFare: z.number().nonnegative().optional(),
                direction: z.enum(["outbound", "return"]).optional(),
            }),
        )
        .default([]),
    updatedAt: z.string().optional(),
});

export const ItineraryTransportSchema = z.object({
    type: z.enum(["flight", "train", "bus", "cab", "metro", "rental", "walking"]),
    from: z.string(),
    to: z.string(),
    durationMinutes: z.number().int().positive(),
    estimatedCost: z.number().nonnegative(),
    currency: z.string().default("INR"),
    frequency: z.string().optional(),
});

export const ItineraryDayActivitySchema = z.object({
    time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    type: z.enum(["visit", "meal", "transport", "free_time", "accommodation"]),
    title: z.string(),
    description: z.string(),
    place: z.object({
        name: z.string(),
        category: z.string(),
        location: z.string(),
        visitDurationHours: z.number().positive(),
    }).optional(),
    cost: z.number().nonnegative().optional(),
});

const ItineraryDaySchema = z.object({
    day: z.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    theme: z.string().optional(),
    activities: z.array(ItineraryDayActivitySchema).min(3).max(6),
    dailyBudget: z.number().nonnegative().optional(),
}).refine((day) => day.activities.length >= 1, {
    message: "At least 1 activity required",
});

export const BudgetBreakdownSchema = z.object({
    accommodation: z.number().nonnegative(),
    food: z.number().nonnegative(),
    transport: z.number().nonnegative(),
    activities: z.number().nonnegative(),
    miscellaneous: z.number().nonnegative(),
    total: z.number().nonnegative(),
    currency: z.string().default("INR"),
});

/**
 * How the costed itinerary came out against the budget the traveler asked for.
 *
 * The budget field is a PREFERENCE, not a cap: we never refuse to plan a trip
 * because the number is low. Instead the trip is costed from its actual items
 * and the result is reported honestly — if it does not fit, say by how much and
 * what budget would work, rather than quietly reshaping the breakdown to match
 * the requested figure.
 *
 * `estimatedTotal` always equals `budgetBreakdown.total`.
 */
export const BudgetVerdictSchema = z.object({
    /** What the traveler typed, or null if they left it blank. */
    requestedBudget: z.number().nonnegative().nullable(),
    /** Costed total for the whole trip, intercity travel included. */
    estimatedTotal: z.number().nonnegative(),
    /** estimatedTotal - requestedBudget. Positive means over budget. */
    difference: z.number().nullable(),
    withinBudget: z.boolean(),
    /** A workable budget, rounded up, when the trip does not fit. */
    suggestedBudget: z.number().nonnegative().nullable(),
    /**
     * False when the intercity fare in `transport` is our own floor estimate
     * rather than a figure from the itinerary, so the UI can hedge the number.
     */
    intercityFareEstimated: z.boolean(),
    /** Short plain-language notes for the UI, already traveler-readable. */
    notes: z.array(z.string()).default([]),
    currency: z.string().default("INR"),
});

export const EmergencyInfoSchema = z.object({
    nearestHospital: z.string(),
    policeStation: z.string(),
    embassy: z.string().optional(),
    emergencyNumber: z.string().default("112"),
});

export const ItineraryOutputSchema = z.object({
    destination: z.string(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    totalDays: z.number().int().positive(),
    overview: z.string().min(100),
    budgetBreakdown: z.object({
        accommodation: z.number().nonnegative(),
        food: z.number().nonnegative(),
        transport: z.number().nonnegative(),
        activities: z.number().nonnegative(),
        miscellaneous: z.number().nonnegative(),
        total: z.number().nonnegative(),
        currency: z.string().default("INR"),
    }),
    // Up to 8, not 3: with real SerpApi listings this is a pick-one shortlist
    // the traveler ticks through, not a top-3 recommendation.
    accommodations: z.array(ItineraryAccommodationSchema).min(1).max(8),
    placesToVisit: z.array(ItineraryPlaceSchema).min(3).max(10),
    transportOptions: z.array(z.object({
        type: z.enum(["flight", "train", "bus", "cab", "metro", "rental", "walking"]),
        from: z.string(),
        to: z.string(),
        durationMinutes: z.number().int().positive(),
        estimatedCost: z.number().nonnegative(),
        currency: z.string().default("INR"),
        frequency: z.string().optional(),
    })).min(1),
    days: z.array(z.object({
        day: z.number().int().positive(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        theme: z.string().optional(),
        activities: z.array(z.object({
            time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
            type: z.enum(["visit", "meal", "transport", "free_time", "accommodation"]),
            title: z.string(),
            description: z.string(),
            place: z.object({
                name: z.string(),
                category: z.string(),
                location: z.string(),
                visitDurationHours: z.number().positive(),
            }).optional(),
            cost: z.number().nonnegative().optional(),
        })).min(3).max(6),
        dailyBudget: z.number().nonnegative().optional(),
    })).min(1),
    tips: z.array(z.string()).min(3).max(8),
    emergencyInfo: z.object({
        nearestHospital: z.string(),
        policeStation: z.string(),
        embassy: z.string().optional(),
        emergencyNumber: z.string().default("112"),
    }).optional(),
    selections: ItinerarySelectionsSchema.optional(),
    budgetVerdict: BudgetVerdictSchema.optional(),
    /**
     * The inputs each budget line was computed from, so the receipt can show
     * "IndiGo-class fare 2,500 x 2 travellers" instead of an unexplained
     * number. Display-only provenance produced by `buildBudget` - never read
     * back into the math, and absent on itineraries saved before it existed.
     * Loosely typed on purpose: it is our own output, it is additive, and a
     * new driver should not fail validation on an old saved trip.
     */
    budgetExplain: z.record(z.string(), z.any()).optional(),
    // Fetched best-effort during generation (features/weather/weather.service.ts
    // `getWeatherForCity`). Mirrors its WeatherPayload shape; absent when the
    // lookup failed or OPEN_WEATHER_API is unconfigured — never blocks generation.
    weather: z.object({
        location: z.object({
            city: z.string(),
            country: z.string().nullable().optional(),
            label: z.string(),
            lat: z.number(),
            lon: z.number(),
            timezoneOffsetSeconds: z.number(),
        }),
        current: z.object({
            observedAt: z.string(),
            localDate: z.string(),
            tempC: z.number(),
            feelsLikeC: z.number(),
            highC: z.number(),
            lowC: z.number(),
            condition: z.string(),
            icon: z.string(),
            humidity: z.number(),
            windKph: z.number(),
            precipitationChance: z.number(),
            cloudCover: z.number(),
            pressureHpa: z.number(),
            visibilityKm: z.number().nullable(),
        }),
        forecast: z.array(z.object({
            date: z.string(),
            day: z.string(),
            highC: z.number(),
            lowC: z.number(),
            icon: z.string(),
            condition: z.string(),
            precipitationChance: z.number(),
        })),
    }).optional(),
    generatedAt: z.string().datetime().optional(),
    version: z.string().default("1.0"),
});

export const MAX_ITINERARY_DAYS = 14;

export const DirectItineraryInputSchema = z.object({
    destination: z
        .string()
        .trim()
        .min(2, "Enter a destination of at least 2 characters.")
        .max(150, "Destination can be at most 150 characters."),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid start date."),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid return date."),
    origin: z.string().trim().optional(),
    fromCity: z.string().trim().optional(),
    adults: z.coerce.number().int("Adults must be a whole number.").positive("Add at least 1 adult.").max(10, "Adults can be at most 10.").default(2),
    children: z.coerce.number().int("Children must be a whole number.").nonnegative("Children cannot be negative.").max(10, "Children can be at most 10.").default(0),
    rooms: z.coerce.number().int("Rooms must be a whole number.").positive("Add at least 1 room.").max(10, "Rooms can be at most 10.").default(1),
    accommodationType: AccommodationTypeSchema.default("standard"),
    preferredTransport: TransportModeSchema.optional(),
    tripType: TripTypeSchema.default("couple"),
    interests: z.array(z.enum(["nature", "adventure", "beaches", "spiritual", "shopping", "food", "wildlife", "history"])).default([]),
    wheelchairAccessible: z.boolean().default(false),
    travelStyle: TravelStyleSchema.default("balanced"),
    specialRequests: z.string().max(2000, "Special requests can be at most 2000 characters.").optional(),
    budget: z.coerce.number().positive("Enter a budget greater than 0, or leave it blank.").optional(),
}).refine((data) => data.endDate >= data.startDate, {
    message: "Return date must be on or after the start date.",
    path: ["endDate"],
}).refine((data) => {
    const start = new Date(`${data.startDate}T00:00:00`);
    const end = new Date(`${data.endDate}T00:00:00`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    return days <= MAX_ITINERARY_DAYS;
}, {
    message: `Trips can be at most ${MAX_ITINERARY_DAYS} days so the planner can return a complete itinerary.`,
    path: ["endDate"],
});

export function formatZodError(error: z.ZodError) {
    const { fieldErrors, formErrors } = error.flatten();
    const messages = [
        ...formErrors,
        ...Object.values(fieldErrors).flat().filter((msg): msg is string => Boolean(msg)),
    ];
    return {
        message: messages[0] || "Please check your trip details and try again.",
        errors: fieldErrors,
    };
}

/**
 * What a client is allowed to write back into a day via PATCH.
 *
 * Unknown keys are dropped (zod strips by default), which is the point: a
 * `days` patch must not be able to carry anything else into the stored
 * document. The field types are looser than ItineraryDayActivitySchema on
 * purpose — the day editor exposes free-text time and type inputs, so
 * enforcing the generator's enums here would reject legitimate user edits —
 * but every string is length-capped and every array is size-capped, because
 * this blob is re-rendered into a PDF and a public share page.
 *
 * Note there are deliberately NO url-ish fields here. Activities render as
 * escaped text in React and as text in the PDF, so they are not an injection
 * sink; the URL-bearing fields (accommodation photos and booking links, place
 * photos) live elsewhere and are not client-writable at all.
 */
export const ItineraryDayPatchSchema = z.object({
    day: z.coerce.number().int().positive().max(366),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    theme: z.string().max(200).optional(),
    dailyBudget: z.coerce.number().nonnegative().max(100_000_000).optional(),
    activities: z
        .array(
            z.object({
                time: z.string().max(20).optional(),
                type: z.string().max(40).optional(),
                title: z.string().max(300),
                description: z.string().max(2000).optional(),
                cost: z.coerce.number().nonnegative().max(100_000_000).optional(),
                place: z
                    .object({
                        name: z.string().max(300).optional(),
                        category: z.string().max(100).optional(),
                        location: z.string().max(300).optional(),
                        visitDurationHours: z.coerce.number().nonnegative().max(720).optional(),
                    })
                    .optional(),
            }),
        )
        .max(30),
});

export const RegenerateInputSchema = z.object({
    modifications: z
        .string()
        .min(10, "Describe the changes in at least 10 characters.")
        .max(2000, "Keep change notes under 2000 characters."),
    preserveStructure: z.boolean().default(true),
});

export const ItineraryResponseSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    destination: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    totalDays: z.number(),
    totalBudget: z.number().optional(),
    currency: z.string(),
    status: z.string(),
    itineraryData: z.any(),
    userAnswers: z.record(z.string(), z.any()).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export const GenerateQuestionsInputSchema = z.object({
    destination: z.string().min(2).max(150),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    previousAnswers: z.record(z.string(), z.any()).optional(),
    userPreferences: z.object({
        budgetRange: z.object({ min: z.number(), max: z.number(), currency: z.string().default("INR") }).optional(),
        travelStyle: z.string().optional(),
        interests: z.array(z.string()).optional(),
        groupSize: z.number().int().positive().optional(),
        dietaryRestrictions: z.array(z.string()).optional(),
        mobilityNeeds: z.string().optional(),
    }).optional(),
});

export type ItineraryOutput = z.infer<typeof ItineraryOutputSchema>;
export type ItineraryPlace = z.infer<typeof ItineraryPlaceSchema>;
export type ItineraryAccommodation = z.infer<typeof ItineraryAccommodationSchema>;
export type ItinerarySelections = z.infer<typeof ItinerarySelectionsSchema>;
export type ItineraryTransport = z.infer<typeof ItineraryTransportSchema>;
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;
export type ItineraryDayActivity = z.infer<typeof ItineraryDayActivitySchema>;
export type BudgetBreakdown = z.infer<typeof BudgetBreakdownSchema>;
export type BudgetVerdict = z.infer<typeof BudgetVerdictSchema>;
export type DirectItineraryInput = z.infer<typeof DirectItineraryInputSchema>;
export type RegenerateInput = z.infer<typeof RegenerateInputSchema>;
export type ItineraryResponse = z.infer<typeof ItineraryResponseSchema>;
export type GenerateQuestionsInput = z.infer<typeof GenerateQuestionsInputSchema>;