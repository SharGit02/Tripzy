/**
 * Direct itinerary generation, PDF, regenerate, and CRUD.
 * Questionnaire / Q&A is extracted to itinerary.questionnaire.future.ts
 * (FUTURE USE — not imported by routes).
 */
import {
    itineraryAI,
    validateItineraryIntegrity,
} from "./itinerary.ai.service.js";

import { itineraryRepository } from "./itinerary.repository.js";

import { generateItineraryPdf } from "../../services/pdf/pdf.service.js";

import { getHotelsOrEmpty, type Hotel } from "../hotels/hotels.service.js";
import { getWeatherForCity } from "../weather/weather.service.js";
import { predictFareWindow } from "../flightFare/flightFare.service.js";
import { predictRailFareWindow } from "../railFare/railFare.service.js";
import { predictBusFareWindow } from "../busFare/busFare.service.js";

import type {
    DirectItineraryInput,
    RegenerateInput,
} from "./itinerary.schema.js";

import {
    ItineraryOutputSchema,
} from "./itinerary.schema.js";

/* ============================================================
   DATE HELPERS
============================================================ */

function calculateDays(
    startDate: string,
    endDate: string
): number {
    const start = new Date(
        `${startDate}T00:00:00`
    );

    const end = new Date(
        `${endDate}T00:00:00`
    );

    const diff = Math.floor(
        (end.getTime() - start.getTime()) /
        86400000
    );

    return Math.max(1, diff + 1);
}

function getDateForDay(
    startDate: string,
    dayIndex: number
): string {
    const date = new Date(
        `${startDate}T00:00:00`
    );

    date.setDate(
        date.getDate() + dayIndex
    );

    return date
        .toISOString()
        .split("T")[0];
}

/* ============================================================
   COST NORMALIZATION
============================================================ */

function parseCostString(
    value: unknown
): number {
    if (
        value === undefined ||
        value === null
    ) {
        return 0;
    }

    if (
        typeof value === "number" &&
        Number.isFinite(value)
    ) {
        return Math.max(0, value);
    }

    const text = String(value)
        .replace(/₹/g, "")
        .replace(/INR/gi, "")
        .replace(/,/g, "")
        .trim();

    if (!text) {
        return 0;
    }

    if (
        text.toLowerCase() === "free" ||
        text.toLowerCase() === "variable" ||
        text.toLowerCase() === "n/a" ||
        text.toLowerCase() === "not specified"
    ) {
        return 0;
    }

    const matches =
        text.match(
            /(\d+(?:\.\d+)?)/g
        );

    if (!matches?.length) {
        return 0;
    }

    const numbers = matches
        .map(Number)
        .filter(Number.isFinite);

    if (!numbers.length) {
        return 0;
    }

    if (numbers.length >= 2) {
        return Math.max(
            0,
            Math.round(
                (numbers[0] + numbers[1]) /
                2
            )
        );
    }

    return Math.max(
        0,
        Math.round(numbers[0])
    );
}

/* ============================================================
   TIME NORMALIZATION
============================================================ */

function normalizeTime(
    value: unknown,
    index = 0
): string {
    if (!value) {
        const defaults = [
            "09:00",
            "13:00",
            "18:00",
            "20:00",
        ];

        return (
            defaults[index] ||
            "09:00"
        );
    }

    const raw = String(value)
        .trim();

    const match24 =
        raw.match(
            /^(\d{1,2}):(\d{2})$/
        );

    if (match24) {
        const hour =
            Number(match24[1]);

        const minute =
            Number(match24[2]);

        if (
            hour >= 0 &&
            hour <= 23 &&
            minute >= 0 &&
            minute <= 59
        ) {
            return `${String(hour).padStart(
                2,
                "0"
            )}:${String(minute).padStart(
                2,
                "0"
            )}`;
        }
    }

    const match12 =
        raw.match(
            /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i
        );

    if (match12) {
        let hour =
            Number(match12[1]);

        const minute =
            Number(match12[2] || 0);

        const meridiem =
            match12[3].toUpperCase();

        if (
            meridiem === "AM" &&
            hour === 12
        ) {
            hour = 0;
        }

        if (
            meridiem === "PM" &&
            hour !== 12
        ) {
            hour += 12;
        }

        return `${String(hour).padStart(
            2,
            "0"
        )}:${String(minute).padStart(
            2,
            "0"
        )}`;
    }

    const lower =
        raw.toLowerCase();

    if (lower.includes("early morning"))
        return "08:00";

    if (lower.includes("morning"))
        return "09:00";

    if (lower.includes("breakfast"))
        return "09:00";

    if (lower.includes("late morning"))
        return "11:00";

    if (lower.includes("lunch"))
        return "13:00";

    if (lower.includes("afternoon"))
        return "15:00";

    if (lower.includes("evening"))
        return "18:00";

    if (lower.includes("dinner"))
        return "20:00";

    if (lower.includes("night"))
        return "20:00";

    const defaults = [
        "09:00",
        "13:00",
        "18:00",
        "20:00",
    ];

    return (
        defaults[index] ||
        "09:00"
    );
}

/* ============================================================
   ACTIVITY NORMALIZATION
============================================================ */

type ActivityType =
    | "visit"
    | "meal"
    | "transport"
    | "free_time"
    | "accommodation";

function normalizeActivityType(
    activity: any
): ActivityType {
    const explicit =
        String(
            activity?.type || ""
        ).toLowerCase();

    if (
        [
            "visit",
            "meal",
            "transport",
            "free_time",
            "accommodation",
        ].includes(explicit)
    ) {
        return explicit as ActivityType;
    }

    const title =
        String(
            activity?.title ??
            activity?.activity_name ??
            activity?.activity ??
            activity?.name ??
            ""
        ).toLowerCase();

    if (
        /airport|transfer|taxi|cab|drive|transport|flight|train|bus|station|checkout|check-out|departure/.test(
            title
        )
    ) {
        return "transport";
    }

    if (
        /breakfast|lunch|dinner|restaurant|cafe|food|meal|drinks|coffee|brunch/.test(
            title
        )
    ) {
        return "meal";
    }

    if (
        /hotel|resort|check-in|check in|accommodation|stay/.test(
            title
        )
    ) {
        return "accommodation";
    }

    if (
        /leisure|free time|relax|at leisure|downtime/.test(
            title
        )
    ) {
        return "free_time";
    }

    return "visit";
}

function normalizeActivity(
    activity: any,
    index: number,
    destination: string
): any {
    const title = String(
        activity?.title ??
        activity?.activity_name ??
        activity?.activity ??
        activity?.name ??
        `Activity ${index + 1}`
    ).trim();

    const description =
        String(
            activity?.description ??
            activity?.details ??
            `Enjoy ${title}.`
        ).trim();

    const location =
        String(
            activity?.location ??
            activity?.place?.location ??
            destination
        ).trim();

    const type =
        normalizeActivityType(
            activity
        );

    const cost =
        parseCostString(
            activity?.cost ??
            activity?.costEstimate ??
            activity?.cost_estimate
        );

    const visitDuration =
        Number(
            activity?.place
                ?.visitDurationHours
        );

    return {
        time: normalizeTime(
            activity?.time,
            index
        ),

        type,

        title,

        description,

        ...(location
            ? {
                  place: {
                      name: title,
                      category:
                          String(
                              activity
                                  ?.place
                                  ?.category ||
                              type
                          ),
                      location,
                      visitDurationHours:
                          Number.isFinite(
                              visitDuration
                          ) &&
                          visitDuration > 0
                              ? visitDuration
                              : 1,
                  },
              }
            : {}),

        cost,
    };
}

/* ============================================================
   ACCOMMODATION
============================================================ */

function normalizeAccommodationType(
    value: unknown
):
    | "hotel"
    | "flat"
    | "hostel"
    | "resort"
    | "homestay" {
    const text =
        String(
            value || ""
        ).toLowerCase();

    if (
        text.includes("resort")
    )
        return "resort";

    if (
        text.includes("hostel")
    )
        return "hostel";

    if (
        text.includes("flat") ||
        text.includes("apartment")
    )
        return "flat";

    if (
        text.includes("homestay")
    )
        return "homestay";

    return "hotel";
}

/**
 * Maps a SerpApi listing onto the itinerary's accommodation shape.
 *
 * `type` is narrowed to the itinerary's own enum: Google Hotels only
 * distinguishes "hotel" from "vacation rental", so a rental becomes a
 * "homestay" — the closest member of our enum, and the honest label for what a
 * Google vacation rental usually is.
 */
function hotelToAccommodation(hotel: Hotel): any {
    return {
        name: hotel.name,
        type: hotel.type === "vacation_rental" ? "homestay" : "hotel",
        pricePerNight: Math.max(1, Math.round(hotel.pricePerNight)),
        currency: hotel.currency || "INR",
        location: hotel.location,
        amenities: hotel.amenities.length
            ? hotel.amenities
            : ["Wi-Fi", "Air conditioning", "Private bathroom"],
        description:
            hotel.description ||
            `${hotel.hotelClass ? `${hotel.hotelClass}-star ` : ""}stay in ${hotel.location}.`,
        source: "serpapi",
        totalPrice: hotel.totalPrice,
        ...(hotel.rating !== null ? { rating: hotel.rating } : {}),
        ...(hotel.reviewsCount !== null ? { reviewsCount: hotel.reviewsCount } : {}),
        ...(hotel.locationRating !== null ? { locationRating: hotel.locationRating } : {}),
        ...(hotel.hotelClass !== null ? { hotelClass: hotel.hotelClass } : {}),
        ...(hotel.imageUrl ? { imageUrl: hotel.imageUrl } : {}),
        ...(hotel.thumbnailUrl ? { thumbnailUrl: hotel.thumbnailUrl } : {}),
        ...(hotel.bookingLink ? { bookingLink: hotel.bookingLink } : {}),
        ...(hotel.checkInTime ? { checkInTime: hotel.checkInTime } : {}),
        ...(hotel.checkOutTime ? { checkOutTime: hotel.checkOutTime } : {}),
        ...(hotel.reviewHighlights.length ? { reviewHighlights: hotel.reviewHighlights } : {}),
    };
}

function buildAccommodations(
    aiOutput: any,
    input: DirectItineraryInput,
    hotels: Hotel[] = []
): any[] {
    /*
     * Real listings win outright when we have them: they carry live prices,
     * ratings, photos and a booking link, none of which the model can supply.
     *
     * The one thing the model does contribute is the CHOICE — it was given this
     * same shortlist and picked the stay that fits the trip, so its pick is
     * floated to the top of the list as the default selection, and the rest
     * follow as alternatives the traveler can tick instead.
     */
    if (hotels.length > 0) {
        const aiPick = String(
            aiOutput?.accommodation?.name ??
            aiOutput?.accommodations?.[0]?.name ??
            ""
        )
            .trim()
            .toLowerCase();

        const ordered = [...hotels];

        if (aiPick) {
            const pickIndex = ordered.findIndex(
                (hotel) => hotel.name.trim().toLowerCase() === aiPick
            );

            if (pickIndex > 0) {
                ordered.unshift(...ordered.splice(pickIndex, 1));
            }
        }

        return ordered.slice(0, 8).map(hotelToAccommodation);
    }

    const candidates: any[] = [];

    if (
        aiOutput?.accommodation &&
        typeof aiOutput.accommodation ===
            "object"
    ) {
        candidates.push(
            aiOutput.accommodation
        );
    }

    if (
        Array.isArray(
            aiOutput?.accommodations
        )
    ) {
        candidates.push(
            ...aiOutput.accommodations
        );
    }

    const accommodations =
        candidates.map(
            (acc: any) => ({
                name: String(
                    acc?.name ??
                    acc?.suggested_hotel ??
                    "Recommended accommodation"
                ),

                type:
                    normalizeAccommodationType(
                        acc?.type ??
                        acc?.category ??
                        aiOutput?.accommodationType ??
                        input.accommodationType
                    ),

                pricePerNight:
                    Math.max(
                        1,
                        parseCostString(
                            acc?.pricePerNight ??
                            acc?.price_per_night ??
                            acc?.price ??
                            4000
                        )
                    ),

                currency: String(
                    acc?.currency ||
                    "INR"
                ),

                location: String(
                    acc?.location ||
                    input.destination
                ),

                amenities:
                    Array.isArray(
                        acc?.amenities
                    )
                        ? acc.amenities.map(
                              String
                          )
                        : [
                              "Wi-Fi",
                              "Air conditioning",
                              "Private bathroom",
                          ],

                description:
                    String(
                        acc?.description ||
                        `Recommended ${
                            input.accommodationType
                        } accommodation in ${
                            input.destination
                        }.`
                    ),

                source: "ai",
            })
        );

    if (
        accommodations.length
    ) {
        return accommodations
            .slice(0, 3);
    }

    const nightly =
        input.accommodationType ===
        "luxury"
            ? 12000
            : input.accommodationType ===
              "premium"
            ? 7000
            : input.accommodationType ===
              "budget"
            ? 2200
            : 4000;

    return [
        {
            name: `Recommended ${input.accommodationType} stay in ${input.destination}`,
            type:
                normalizeAccommodationType(
                    input.accommodationType
                ),
            pricePerNight: nightly,
            currency: "INR",
            location:
                input.destination,
            amenities: [
                "Wi-Fi",
                "Air conditioning",
                "Private bathroom",
            ],
            description:
                `Recommended ${input.accommodationType} accommodation based on your trip preferences.`,
            source: "ai",
        },
    ];
}

/* ============================================================
   TRANSPORT
============================================================ */

function normalizeTransportType(
    value: unknown
):
    | "flight"
    | "train"
    | "bus"
    | "cab"
    | "metro"
    | "rental"
    | "walking" {
    const text =
        String(
            value || ""
        ).toLowerCase();

    if (
        text.includes("flight") ||
        text.includes("air")
    ) {
        return "flight";
    }

    if (
        text.includes("train") ||
        text.includes("rail")
    ) {
        return "train";
    }

    if (
        text.includes("bus")
    ) {
        return "bus";
    }

    if (
        text.includes("metro")
    ) {
        return "metro";
    }

    if (
        text.includes("rental") ||
        text.includes("scooter") ||
        text.includes("self-drive") ||
        text.includes("self drive") ||
        text.includes("car")
    ) {
        return "rental";
    }

    if (
        text.includes("walk")
    ) {
        return "walking";
    }

    return "cab";
}

function buildTransportOptions(
    aiOutput: any,
    input: DirectItineraryInput
): any[] {
    const options: any[] = [];

    if (
        Array.isArray(
            aiOutput?.transportOptions
        )
    ) {
        for (
            const transport of
                aiOutput.transportOptions
        ) {
            options.push({
                type:
                    normalizeTransportType(
                        transport?.type
                    ),

                from: String(
                    transport?.from ||
                    "Origin"
                ),

                to: String(
                    transport?.to ||
                    input.destination
                ),

                durationMinutes:
                    Math.max(
                        1,
                        Number(
                            transport?.durationMinutes
                        ) || 60
                    ),

                estimatedCost:
                    parseCostString(
                        transport?.estimatedCost ??
                        transport?.cost ??
                        transport?.costEstimate
                    ),

                /*
                 * Every cost figure in this file is summed and displayed as
                 * INR (see ITINERARY_SYSTEM_PROMPT, parseCostString and
                 * costTransport) regardless of what this field says, so
                 * trusting an AI-supplied currency string here would let a
                 * single leg's label drift from the number actually added to
                 * the INR total. Every other branch in this function already
                 * hardcodes "INR"; this one now matches.
                 */
                currency: "INR",
            });
        }
    }

    /*
     * NEW AI FORMAT:
     *
     * transportType: {
     *   interCity: "Flights",
     *   local: "Cabs and Rental Scooters"
     * }
     */

    if (
        !options.length &&
        aiOutput?.transportType
    ) {
        const interCity =
            aiOutput.transportType
                ?.interCity;

        const local =
            aiOutput.transportType
                ?.local;

        if (interCity) {
            options.push({
                type:
                    normalizeTransportType(
                        interCity
                    ),

                from: "Origin",

                to: input.destination,

                durationMinutes:
                    60,

                /*
                 * 0 means "not estimated".
                 * Never use -1 because Zod
                 * requires non-negative.
                 */
                estimatedCost: 0,

                currency: "INR",
            });
        }

        if (
            local &&
            normalizeTransportType(
                local
            ) !==
                normalizeTransportType(
                    interCity
                )
        ) {
            options.push({
                type:
                    normalizeTransportType(
                        local
                    ),

                from:
                    input.destination,

                to:
                    "Local attractions",

                durationMinutes:
                    30,

                estimatedCost: 0,

                currency: "INR",
            });
        }
    }

    /*
     * Backward-compatible AI formats.
     */

    if (!options.length) {
        const oldTransport =
            aiOutput?.transport_preference ??
            aiOutput?.preferred_transport;

        if (
            typeof oldTransport ===
            "object"
        ) {
            if (
                oldTransport.inter_city
            ) {
                options.push({
                    type:
                        normalizeTransportType(
                            oldTransport.inter_city
                        ),
                    from: "Origin",
                    to:
                        input.destination,
                    durationMinutes:
                        60,
                    estimatedCost:
                        0,
                    currency:
                        "INR",
                });
            }

            if (
                oldTransport.local
            ) {
                options.push({
                    type:
                        normalizeTransportType(
                            oldTransport.local
                        ),
                    from:
                        input.destination,
                    to:
                        "Local attractions",
                    durationMinutes:
                        30,
                    estimatedCost:
                        0,
                    currency:
                        "INR",
                });
            }
        } else if (
            oldTransport
        ) {
            options.push({
                type:
                    normalizeTransportType(
                        oldTransport
                    ),
                from: "Origin",
                to:
                    input.destination,
                durationMinutes:
                    60,
                estimatedCost:
                    0,
                currency:
                    "INR",
            });
        }
    }

    /*
     * Final guaranteed fallback.
     */

    if (!options.length) {
        options.push({
            type:
                normalizeTransportType(
                    input.preferredTransport ||
                    "cab"
                ),

            from: "Origin",

            to: input.destination,

            durationMinutes: 60,

            estimatedCost: 0,

            currency: "INR",
        });
    }

    console.log(
        "[ITINERARY] Transport normalized:",
        options
    );

    return options;
}

/* ============================================================
   PLACES
============================================================ */

function buildPlaces(
    aiOutput: any,
    days: any[],
    input: DirectItineraryInput
): any[] {
    const places: any[] = [];

    const seen =
        new Set<string>();

    const addPlace = (
        place: any
    ) => {
        if (
            places.length >= 10
        ) {
            return;
        }

        const name =
            String(
                place?.name ||
                "Recommended place"
            ).trim();

        const key =
            name.toLowerCase();

        if (
            !name ||
            seen.has(key)
        ) {
            return;
        }

        seen.add(key);

        places.push({
            name,

            description:
                String(
                    place?.description ||
                    `Explore ${name} during your trip.`
                ),

            category:
                String(
                    place?.category ||
                    "attraction"
                ),

            location:
                String(
                    place?.location ||
                    input.destination
                ),

            visitDurationHours:
                Number(
                    place?.visitDurationHours
                ) > 0
                    ? Number(
                          place.visitDurationHours
                      )
                    : 2,

            bestTimeToVisit:
                String(
                    place?.bestTimeToVisit ||
                    "Morning or afternoon"
                ),

            priceRange:
                String(
                    place?.priceRange ??
                    "Free"
                ),

            imageUrl: place?.imageUrl ? String(place.imageUrl) : undefined,
            imageAuthor: place?.imageAuthor ? String(place.imageAuthor) : undefined,
            imageLicense: place?.imageLicense ? String(place.imageLicense) : undefined,
            imageSource: place?.imageSource ? String(place.imageSource) : undefined,
        });
    };

    /*
     * Existing places from old AI format.
     */

    if (
        Array.isArray(
            aiOutput?.placesToVisit
        )
    ) {
        for (
            const place of
                aiOutput.placesToVisit
        ) {
            addPlace(place);
        }
    }

    /*
     * New AI format has places inside activities.
     */

    for (
        const day of days
    ) {
        for (
            const activity of
                day.activities || []
        ) {
            if (
                [
                    "meal",
                    "transport",
                    "free_time",
                    "accommodation",
                ].includes(
                    activity.type
                )
            ) {
                continue;
            }

            addPlace({
                name:
                    activity.title,

                description:
                    activity.description,

                category:
                    activity.place
                        ?.category ||
                    "attraction",

                location:
                    activity.place
                        ?.location ||
                    input.destination,

                visitDurationHours:
                    activity.place
                        ?.visitDurationHours ||
                    2,

                bestTimeToVisit:
                    "Morning or afternoon",

                priceRange:
                    activity.cost > 0
                        ? `INR ${activity.cost}`
                        : "Free",
            });
        }
    }

    /*
     * Minimum schema requirement.
     */

    while (
        places.length < 3
    ) {
        addPlace({
            name: `Popular attraction in ${input.destination}`,
            description:
                `Explore this recommended attraction during your trip.`,
            category:
                "attraction",
            location:
                input.destination,
            visitDurationHours:
                2,
            bestTimeToVisit:
                "Morning or afternoon",
            priceRange:
                "Free",
        });

        if (
            places.length < 3
        ) {
            addPlace({
                name: `Local sightseeing in ${input.destination}`,
                description:
                    `Discover local highlights and nearby attractions.`,
                category:
                    "sightseeing",
                location:
                    input.destination,
                visitDurationHours:
                    2,
                bestTimeToVisit:
                    "Morning or afternoon",
                priceRange:
                    "Free",
            });
        }
    }

    return places.slice(
        0,
        10
    );
}

/* ============================================================
   DAYS
============================================================ */

function extractRawDays(
    aiOutput: any
): any[] {
    if (
        Array.isArray(
            aiOutput?.itinerary
        )
    ) {
        return aiOutput.itinerary;
    }

    if (
        Array.isArray(
            aiOutput?.days
        )
    ) {
        return aiOutput.days;
    }

    if (
        Array.isArray(
            aiOutput?.daily_itinerary
        )
    ) {
        return aiOutput.daily_itinerary;
    }

    if (
        Array.isArray(
            aiOutput?.schedule
        )
    ) {
        return aiOutput.schedule;
    }

    return [];
}

function buildDays(
    aiOutput: any,
    input: DirectItineraryInput
): any[] {
    const totalDays =
        calculateDays(
            input.startDate,
            input.endDate
        );

    const rawDays =
        extractRawDays(
            aiOutput
        );

    console.log(
        "[ITINERARY] AI days detected:",
        rawDays.length
    );

    console.log(
        "[ITINERARY] Requested dates:",
        `${input.startDate} -> ${input.endDate} = ${totalDays} days`
    );

    return Array.from(
        { length: totalDays },
        (_, dayIndex) => {
            const rawDay =
                rawDays[dayIndex] ||
                {};

            const rawActivities =
                Array.isArray(
                    rawDay?.activities
                )
                    ? rawDay.activities
                    : [];

            let activities =
                rawActivities
                    .map(
                        (
                            activity: any,
                            index: number
                        ) =>
                            normalizeActivity(
                                activity,
                                index,
                                input.destination
                            )
                    )
                    .slice(0, 6);

            /*
             * Only fill genuinely missing
             * activities.
             *
             * We NEVER replace a valid AI
             * day with "Free day".
             */

            const fallbackActivities =
                [
                    {
                        time: "09:00",
                        type: "visit",
                        title:
                            "Local Exploration",
                        description:
                            `Explore the local area around ${input.destination}.`,
                        cost: 0,
                    },

                    {
                        time: "13:00",
                        type: "meal",
                        title:
                            "Local Lunch",
                        description:
                            "Enjoy a local meal at a recommended restaurant.",
                        cost: 0,
                    },

                    {
                        time: "18:00",
                        type: "visit",
                        title:
                            "Evening at Leisure",
                        description:
                            "Relax and enjoy the evening at your destination.",
                        cost: 0,
                    },
                ];

            while (
                activities.length <
                3
            ) {
                activities.push(
                    fallbackActivities[
                        activities.length
                    ]
                );
            }

            const date =
                getDateForDay(
                    input.startDate,
                    dayIndex
                );

            const dailyBudget =
                activities.reduce(
                    (
                        total: number,
                        activity: any
                    ) =>
                        total +
                        parseCostString(
                            activity.cost
                        ),
                    0
                );

            return {
                day:
                    dayIndex + 1,

                date,

                theme:
                    String(
                        rawDay?.theme ||
                        rawDay?.title ||
                        `Day ${dayIndex + 1}`
                    ),

                activities,

                dailyBudget,
            };
        }
    );
}

/* ============================================================
   BUDGET
============================================================ */

/*
 * Cheapest realistic round trip PER PERSON, used only when the itinerary
 * carries no intercity fare of its own.
 *
 * Mirrors INTERCITY_FLOOR in `Client/src/pages/Catalog/lib/minimumBudget.js`.
 * Change one, change the other, or the minimum we warn about before generating
 * stops matching the total we report after generating.
 */
const INTERCITY_FARE_FLOOR: Record<string, number> = {
    flight: 6000,
    train: 1600,
    bus: 1200,
    self_drive: 3500,
};

/*
 * Transport entries that move you AROUND the destination rather than TO it.
 * Everything else (flight, train, bus) is an intercity leg, and intercity legs
 * in `transportOptions` are mutually exclusive alternatives — you take one of
 * them, not all of them.
 */
const LOCAL_TRANSPORT_TYPES = new Set([
    "cab",
    "metro",
    "rental",
    "walking",
]);

function roundUpToSuggestion(
    amount: number
): number {
    if (!Number.isFinite(amount) || amount <= 0) {
        return 0;
    }

    const step =
        amount >= 100_000
            ? 10_000
            : amount >= 20_000
                ? 5_000
                : 1_000;

    return Math.ceil(amount / step) * step;
}

/*
 * The stay we charge for is ONE stay: accommodations[0], which is the default
 * selection (buildAccommodations floats the model's pick to the top). The rest
 * of the list is alternatives the traveler can tick instead.
 *
 * A SerpApi listing carries `totalPrice` for the real date window, which beats
 * multiplying a nightly rate. Either way it is per room, so rooms multiply it.
 */
function costAccommodation(
    accommodations: any[],
    nights: number,
    rooms: number
): {
    amount: number;
    quoted: boolean;
    hotelName: string | null;
    nightlyRate: number;
    windowTotal: number;
} {
    const stay = accommodations[0];

    if (!stay) {
        return { amount: 0, quoted: false, hotelName: null, nightlyRate: 0, windowTotal: 0 };
    }

    const quoted = stay.source === "serpapi";

    const windowTotal = parseCostString(
        stay.totalPrice
    );

    const nightlyRate = parseCostString(
        stay.pricePerNight
    );

    const amount =
        windowTotal > 0
            ? windowTotal * rooms
            : nightlyRate * nights * rooms;

    return {
        amount: Math.round(amount),
        quoted,
        hotelName: stay.name ? String(stay.name) : null,
        nightlyRate: Math.round(nightlyRate),
        windowTotal: Math.round(windowTotal),
    };
}

/*
 * Intercity fare for the whole party, plus whatever local transport the
 * itinerary lists.
 *
 * The model is told to quote intercity fares PER PERSON (see
 * ITINERARY_SYSTEM_PROMPT), so the fare multiplies by party size; local
 * transport is quoted for the trip and does not.
 */
function costTransport(
    transportOptions: any[],
    input: DirectItineraryInput,
    people: number
): {
    amount: number;
    intercityEstimated: boolean;
    mode: string;
    farePerPerson: number;
    local: number;
} {
    const preferred =
        input.preferredTransport || "flight";

    const intercity = transportOptions.filter(
        (option: any) =>
            !LOCAL_TRANSPORT_TYPES.has(
                String(option?.type)
            )
    );

    const leg =
        intercity.find(
            (option: any) =>
                String(option?.type) === preferred
        ) ?? intercity[0];

    const quotedFare = parseCostString(
        leg?.estimatedCost
    );

    /*
     * estimatedCost is 0 when the model declined to price the leg, which is
     * common. Falling back to a floor keeps flights inside the total instead
     * of silently dropping them — the old behaviour, and the reason a trip's
     * total never matched what the traveler actually paid.
     */
    const intercityEstimated = quotedFare <= 0;

    const farePerPerson =
        intercityEstimated
            ? INTERCITY_FARE_FLOOR[preferred] ??
              INTERCITY_FARE_FLOOR.flight
            : quotedFare;

    const local = transportOptions
        .filter((option: any) =>
            LOCAL_TRANSPORT_TYPES.has(
                String(option?.type)
            )
        )
        .reduce(
            (total: number, option: any) =>
                total +
                parseCostString(
                    option?.estimatedCost
                ),
            0
        );

    return {
        amount: Math.round(
            farePerPerson * people + local
        ),
        intercityEstimated,
        mode: String(leg?.type || preferred),
        farePerPerson: Math.round(farePerPerson),
        local: Math.round(local),
    };
}

/*
 * Cost the trip from its own items. One path, always.
 *
 * This used to have three: trust the model's own budgetBreakdown, or split the
 * traveler's requested budget by fixed 40/25/15/10 ratios, or compute from the
 * data. The first two are why a total could equal the requested budget while
 * none of the line items matched the trip — the breakdown was derived from the
 * number instead of from the itinerary. The requested budget is now compared
 * against the costed total (see buildBudgetVerdict), never used to produce it.
 */
function buildBudget(
    aiOutput: any,
    days: any[],
    accommodations: any[],
    transportOptions: any[],
    input: DirectItineraryInput
): any {
    const totalDays = calculateDays(
        input.startDate,
        input.endDate
    );

    const nights = Math.max(1, totalDays - 1);

    const rooms = Math.max(
        1,
        Number(input.rooms) || 1
    );

    const people = Math.max(
        1,
        (Number(input.adults) || 0) +
        (Number(input.children) || 0)
    );

    const stay = costAccommodation(
        accommodations,
        nights,
        rooms
    );

    const travel = costTransport(
        transportOptions,
        input,
        people
    );

    const allActivities = days.flatMap(
        (day: any) => day.activities || []
    );

    /*
     * ponytail: activity and meal costs are taken as quoted for the party, not
     * per head, which is how the model usually phrases them. If entry fees
     * start reading per-person, multiply these by `people` too.
     */
    const activities = allActivities
        .filter(
            (activity: any) =>
                activity.type !== "meal"
        )
        .reduce(
            (total: number, activity: any) =>
                total +
                parseCostString(activity.cost),
            0
        );

    const pricedActivityCount = allActivities.filter(
        (activity: any) =>
            activity.type !== "meal" &&
            parseCostString(activity.cost) > 0
    ).length;

    const meals = allActivities.filter(
        (activity: any) =>
            activity.type === "meal"
    );

    const explicitMealCost = meals
        .reduce(
            (total: number, activity: any) =>
                total +
                parseCostString(activity.cost),
            0
        );

    const food =
        explicitMealCost > 0
            ? explicitMealCost
            : Math.round(
                people * totalDays * 1200
            );

    const miscellaneous = Math.round(
        (
            stay.amount +
            food +
            travel.amount +
            activities
        ) * 0.05
    );

    const total =
        stay.amount +
        food +
        travel.amount +
        activities +
        miscellaneous;

    return {
        accommodation: stay.amount,
        food,
        transport: travel.amount,
        activities,
        miscellaneous,
        total,
        currency: String(
            aiOutput?.budgetBreakdown?.currency ||
            "INR"
        ),
        /*
         * Consumed by buildBudgetVerdict and then dropped — not part of
         * BudgetBreakdownSchema.
         */
        _accommodationQuoted: stay.quoted,
        _intercityEstimated: travel.intercityEstimated,

        /*
         * Lifted out to `budgetExplain` by transformItineraryOutput: every
         * number the lines above were derived from, so the receipt can show
         * the arithmetic instead of a bare total. Display only — nothing reads
         * it back.
         */
        _explain: {
            days: totalDays,
            nights,
            people,
            adults: Math.max(0, Number(input.adults) || 0),
            children: Math.max(0, Number(input.children) || 0),
            rooms,
            accommodation: {
                hotel: stay.hotelName,
                nightlyRate: stay.nightlyRate,
                windowTotal: stay.windowTotal,
                nights,
                rooms,
                quoted: stay.quoted,
            },
            food: {
                // "meals" = the day plan priced its own meals; "estimate" =
                // nobody did, so the per-person-per-day fallback applies.
                source: explicitMealCost > 0 ? "meals" : "estimate",
                mealCount: meals.length,
                perPersonPerDay: explicitMealCost > 0 ? null : 1200,
                people,
                days: totalDays,
            },
            transport: {
                mode: travel.mode,
                farePerPerson: travel.farePerPerson,
                people,
                local: travel.local,
                estimated: travel.intercityEstimated,
            },
            activities: {
                count: pricedActivityCount,
            },
            miscellaneous: {
                rate: 0.05,
            },
        },
    };
}

/*
 * Compare the costed trip against what the traveler asked to spend.
 *
 * Reports, never rewrites: a low budget produces a verdict explaining the gap
 * and a figure that works, and the itinerary itself stays intact.
 */
function buildBudgetVerdict(
    breakdown: any,
    input: DirectItineraryInput
): any {
    const estimatedTotal = Math.round(
        breakdown?.total || 0
    );

    const requested =
        input.budget && input.budget > 0
            ? Math.round(input.budget)
            : null;

    const intercityFareEstimated = Boolean(
        breakdown?._intercityEstimated
    );

    const notes: string[] = [];

    if (intercityFareEstimated) {
        notes.push(
            `Travel to and from ${input.destination} is a typical-fare estimate, not a quote. Check predicted fares for your dates.`
        );
    }

    if (breakdown?._accommodationQuoted) {
        notes.push(
            "Stay cost uses live nightly rates for your dates."
        );
    }

    if (requested === null) {
        notes.push(
            "No preferred budget was set, so this is simply what the trip is expected to cost."
        );

        return {
            requestedBudget: null,
            estimatedTotal,
            difference: null,
            withinBudget: true,
            suggestedBudget: null,
            intercityFareEstimated,
            notes,
            currency: String(
                breakdown?.currency || "INR"
            ),
        };
    }

    const difference = estimatedTotal - requested;

    const withinBudget = difference <= 0;

    if (withinBudget) {
        notes.push(
            `Comes in ${formatInr(Math.abs(difference))} under your preferred budget.`
        );
    } else {
        notes.push(
            `This trip costs about ${formatInr(difference)} more than your preferred budget of ${formatInr(requested)}.`
        );
        notes.push(
            "Shortening the trip, dropping to a cheaper stay or travelling by train or bus would bring it down."
        );
    }

    return {
        requestedBudget: requested,
        estimatedTotal,
        difference,
        withinBudget,
        suggestedBudget: withinBudget
            ? null
            : roundUpToSuggestion(estimatedTotal),
        intercityFareEstimated,
        notes,
        currency: String(
            breakdown?.currency || "INR"
        ),
    };
}

function formatInr(amount: number): string {
    return `₹${Math.round(
        amount
    ).toLocaleString("en-IN")}`;
}

/**
 * Clamps each budget category to >= 0, recomputes `total` as the literal sum
 * of those clamped categories, and rebuilds `budgetVerdict` against that
 * corrected total. Mutates `itinerary` in place.
 *
 * Never trust a model's own `budgetBreakdown.total` verbatim: it used to
 * equal the requested budget even when no line item matched the trip. Both
 * `generateDirectItinerary` and `regenerateItinerary` call this before
 * saving, so neither path can persist a total that doesn't match the sum of
 * its own line items (the regenerate path used to skip this step entirely).
 */
function recalculateBudgetTotal(itinerary: any, input: DirectItineraryInput): void {
    const budget = itinerary.budgetBreakdown || {};

    itinerary.budgetBreakdown = {
        ...budget,
        accommodation: Math.max(0, Number(budget.accommodation || 0)),
        food: Math.max(0, Number(budget.food || 0)),
        transport: Math.max(0, Number(budget.transport || 0)),
        activities: Math.max(0, Number(budget.activities || 0)),
        miscellaneous: Math.max(0, Number(budget.miscellaneous || 0)),
    };

    itinerary.budgetBreakdown.total =
        itinerary.budgetBreakdown.accommodation +
        itinerary.budgetBreakdown.food +
        itinerary.budgetBreakdown.transport +
        itinerary.budgetBreakdown.activities +
        itinerary.budgetBreakdown.miscellaneous;

    itinerary.budgetVerdict = buildBudgetVerdict(
        {
            ...itinerary.budgetBreakdown,
            _intercityEstimated: itinerary.budgetVerdict?.intercityFareEstimated,
            _accommodationQuoted: itinerary.accommodations?.[0]?.source === "serpapi",
        },
        input,
    );
}

/*
 * Exported for `itinerary.budget.test.ts` only. The budget math is the one part
 * of the transform a traveler checks with a calculator, so it is worth a test
 * that does not need a model call to run.
 */
export const __budgetInternals = {
    buildBudget,
    buildBudgetVerdict,
    roundUpToSuggestion,
    recalculateBudgetTotal,
};

/* ============================================================
   MAIN TRANSFORMER
============================================================ */

function transformItineraryOutput(
    aiOutput: any,
    input: DirectItineraryInput,
    hotels: Hotel[] = []
): any {
    const totalDays =
        calculateDays(
            input.startDate,
            input.endDate
        );

    const days =
        buildDays(
            aiOutput,
            input
        );

    const accommodations =
        buildAccommodations(
            aiOutput,
            input,
            hotels
        );

    const transportOptions =
        buildTransportOptions(
            aiOutput,
            input
        );

    const placesToVisit =
        buildPlaces(
            aiOutput,
            days,
            input
        );

    const costed =
        buildBudget(
            aiOutput,
            days,
            accommodations,
            transportOptions,
            input
        );

    const budgetVerdict =
        buildBudgetVerdict(
            costed,
            input
        );

    /*
     * The two underscore-prefixed provenance flags exist only to get from
     * buildBudget to buildBudgetVerdict; BudgetBreakdownSchema does not have
     * them, so they are dropped before the breakdown is stored.
     */
    const {
        _accommodationQuoted,
        _intercityEstimated,
        _explain: budgetExplain,
        ...budgetBreakdown
    } = costed;

    const tips =
        Array.isArray(
            aiOutput?.tips
        ) &&
        aiOutput.tips.length >= 3
            ? aiOutput.tips
                  .slice(0, 8)
                  .map(String)
            : [
                  "Carry valid identification and travel documents.",
                  "Keep some local currency for small expenses.",
                  "Check local weather before outdoor activities.",
                  "Confirm attraction timings and restaurant reservations before leaving.",
              ];

    const overview =
        String(
            aiOutput?.overview ||
            `A personalized ${totalDays}-day itinerary for ${input.destination}, planned around your travel style, interests, accommodation preference and transportation needs.`
        );

    return {
        destination: String(
            aiOutput?.destination ||
            input.destination
        ),

        startDate:
            input.startDate,

        endDate:
            input.endDate,

        totalDays,

        overview,

        budgetBreakdown,

        budgetVerdict,

        budgetExplain,

        accommodations,

        placesToVisit,

        transportOptions,

        days,

        tips,

        emergencyInfo:
            aiOutput?.emergencyInfo ||
            {
                nearestHospital:
                    "Verify the nearest hospital based on your accommodation location.",
                policeStation:
                    "Verify the nearest police station based on your accommodation location.",
                emergencyNumber:
                    "112",
            },

        generatedAt:
            new Date().toISOString(),

        version: "1.0",
    };
}

/* ============================================================
   SERVICE
============================================================ */

export const itineraryService = {
    async generateDirectItinerary(
        input: DirectItineraryInput,
        userId: string,
        // Best-effort progress callback for the SSE stream in
        // itinerary.controller.ts. Never thrown from, never awaited — a slow or
        // broken listener must not slow down generation.
        onProgress?: (
            stage: "hotels" | "flights" | "trains" | "buses" | "weather" | "ai" | "budget" | "saving",
        ) => void
    ): Promise<{
        itinerary: any;
        itineraryId: string;
    }> {
        console.log(
            "[ITINERARY] ===== GENERATION START ====="
        );

        const requestedDays =
            calculateDays(
                input.startDate,
                input.endDate
            );

        console.log(
            "[ITINERARY] Requested:",
            {
                destination:
                    input.destination,
                startDate:
                    input.startDate,
                endDate:
                    input.endDate,
                totalDays:
                    requestedDays,
            }
        );

        /*
         * Real hotel inventory, destination weather, and a same-date fare
         * check against each intercity mode — all run CONCURRENTLY, so these
         * checks cost as long as the slowest of them, not their sum, and each
         * fires its own progress event the moment it settles. This is what
         * turns the loading page's single opaque "crafting your plan" wait
         * into granular, honest steps: every one of these is a real network
         * call, not a timer.
         *
         * Hotels and weather feed the prompt/document as before (fetched
         * BEFORE generation so the model plans around a stay that actually
         * exists). The fare checks call the exact same prediction services
         * the itinerary page itself uses for its outbound leg.
         *
         * ponytail: the fetched fares aren't fed into the prompt or stored
         * anywhere right now - only used to drive progress. Wire them into
         * transportOptions if "ground the model's transport cost guess in a
         * real same-date fare" is ever wanted; that's a bigger change than a
         * progress step, left alone here so it can't touch the budget math.
         *
         * All five are best-effort: a down service, a route with no fare
         * data, or no known origin all degrade to "checked, nothing learned"
         * rather than slowing down or failing generation.
         */

        const origin = (input.origin || input.fromCity || "").trim();
        const canCheckFares =
            origin.length >= 2 && origin.toLowerCase() !== input.destination.trim().toLowerCase();

        const hotelsPromise = getHotelsOrEmpty({
            destination: input.destination,
            checkIn: input.startDate,
            /*
             * Google Hotels prices a stay, not a day: an identical check-in
             * and check-out returns nothing. A single-day trip still wants
             * one night quoted, so the window is widened to the next morning
             * rather than spending a metered search on a query that cannot
             * return a rate.
             */
            checkOut:
                input.endDate > input.startDate
                    ? input.endDate
                    : getDateForDay(input.startDate, 1),
            adults: input.adults,
        }).finally(() => onProgress?.("hotels"));

        const weatherPromise = getWeatherForCity(input.destination)
            .catch((error) => {
                console.warn("[ITINERARY] Weather lookup failed:", (error as Error).message);
                return undefined;
            })
            .finally(() => onProgress?.("weather"));

        const fareCheck = (
            stage: "flights" | "trains" | "buses",
            run: () => Promise<unknown>,
        ): Promise<unknown> =>
            (canCheckFares ? run().catch(() => null) : Promise.resolve(null)).finally(() =>
                onProgress?.(stage),
            );

        const flightsPromise = fareCheck("flights", () =>
            predictFareWindow({ origin, destination: input.destination, startDate: input.startDate, windowDays: 1 }),
        );
        const trainsPromise = fareCheck("trains", () =>
            predictRailFareWindow({ origin, destination: input.destination, startDate: input.startDate, windowDays: 1 }),
        );
        const busesPromise = fareCheck("buses", () =>
            predictBusFareWindow({ origin, destination: input.destination, startDate: input.startDate, windowDays: 1 }),
        );

        const [hotels, weather] = await Promise.all([
            hotelsPromise,
            weatherPromise,
            flightsPromise,
            trainsPromise,
            busesPromise,
        ]);

        console.log(
            "[ITINERARY] Hotels found:",
            hotels.length
        );

        /*
         * AI generation
         */
        onProgress?.("ai");

        const aiOutput =
            await itineraryAI.generateDirectItinerary(
                input,
                userId,
                hotels
            );

        console.log(
            "[ITINERARY] AI output keys:",
            Object.keys(
                aiOutput || {}
            )
        );

        console.log(
            "[ITINERARY] AI itinerary[] length:",
            Array.isArray(
                aiOutput?.itinerary
            )
                ? aiOutput.itinerary.length
                : 0
        );

        /*
         * NORMALIZATION
         */

        let itinerary =
            transformItineraryOutput(
                aiOutput,
                input,
                hotels
            );

        console.log(
            "[ITINERARY] NORMALIZED:",
            {
                totalDays:
                    itinerary.totalDays,

                days:
                    itinerary.days.length,

                activitiesPerDay:
                    itinerary.days.map(
                        (day: any) =>
                            day.activities.length
                    ),

                transportOptions:
                    itinerary
                        .transportOptions
                        .length,
            }
        );

        /*
         * Date/day hard guarantee.
         */

        itinerary.startDate =
            input.startDate;

        itinerary.endDate =
            input.endDate;

        itinerary.totalDays =
            requestedDays;

        itinerary.days =
            itinerary.days
                .slice(
                    0,
                    requestedDays
                )
                .map(
                    (
                        day: any,
                        index: number
                    ) => ({
                        ...day,

                        day:
                            index + 1,

                        date:
                            getDateForDay(
                                input.startDate,
                                index
                            ),
                    })
                );

        /*
         * Emergency guarantee.
         */

        if (
            !itinerary.emergencyInfo
        ) {
            itinerary.emergencyInfo = {
                nearestHospital:
                    "Verify the nearest hospital based on your accommodation location.",
                policeStation:
                    "Verify the nearest police station based on your accommodation location.",
                emergencyNumber:
                    "112",
            };
        }

        /*
         * Recalculate budget total.
         */

        recalculateBudgetTotal(itinerary, input);
        onProgress?.("budget");

        itinerary.weather = weather;

        /*
         * Integrity validation.
         */

        const integrity =
            validateItineraryIntegrity(
                itinerary
            );

        if (
            !integrity.valid
        ) {
            console.warn(
                "[ITINERARY] Integrity warnings:",
                integrity.issues
            );
        }

        /*
         * Final Zod validation.
         */

        let validated;

        try {
            validated =
                ItineraryOutputSchema.parse(
                    itinerary
                );

            console.log(
                "[ITINERARY] ZOD VALIDATION: SUCCESS"
            );

            console.log(
                "[ITINERARY] FINAL:",
                {
                    totalDays:
                        validated.totalDays,

                    days:
                        validated.days
                            .length,

                    firstDayActivities:
                        validated
                            .days[0]
                            ?.activities
                            ?.length ||
                        0,

                    transportOptions:
                        validated
                            .transportOptions
                            .length,

                    budget:
                        validated
                            .budgetBreakdown
                            .total,
                }
            );
        } catch (error) {
            console.error(
                "[ITINERARY] ZOD VALIDATION: FAILED"
            );

            if (
                error &&
                typeof error ===
                    "object" &&
                "issues" in error
            ) {
                console.error(
                    JSON.stringify(
                        (
                            error as any
                        ).issues,
                        null,
                        2
                    )
                );
            }

            throw error;
        }

        /*
         * SAVE TO DATABASE
         */
        onProgress?.("saving");

        const savedItinerary =
            await itineraryRepository.create(
                userId,
                {
                    title: `${validated.destination} Itinerary`,

                    destination:
                        validated.destination,

                    startDate:
                        validated.startDate,

                    endDate:
                        validated.endDate,

                    totalDays:
                        validated.totalDays,

                    totalBudget:
                        String(
                            validated
                                .budgetBreakdown
                                .total
                        ),

                    currency:
                        validated
                            .budgetBreakdown
                            .currency,

                    itineraryData:
                        validated as any,

                    userAnswers:
                        input as any,

                    status:
                        "completed",
                }
            );

        console.log(
            "[ITINERARY] DATABASE SAVE: SUCCESS",
            {
                itineraryId:
                    savedItinerary.id,
            }
        );

        console.log(
            "[ITINERARY] ===== GENERATION COMPLETE ====="
        );

        return {
            itinerary:
                validated,

            itineraryId:
                savedItinerary.id,
        };
    },

    async getItinerary(
        id: string,
        userId: string
    ) {
        return itineraryRepository
            .findByIdForUser(
                id,
                userId
            );
    },

    async getItineraryById(
        id: string
    ) {
        return itineraryRepository
            .findById(id);
    },

    async listItineraries(
        userId: string,
        limit = 20,
        offset = 0
    ) {
        const [
            items,
            total,
        ] = await Promise.all([
            itineraryRepository
                .findAllByUserId(
                    userId,
                    limit,
                    offset
                ),

            itineraryRepository
                .countByUserId(
                    userId
                ),
        ]);

        return {
            itineraries:
                items,
            total,
            limit,
            offset,
        };
    },

    async deleteItinerary(
        id: string,
        userId: string
    ) {
        return itineraryRepository
            .deleteForUser(
                id,
                userId
            );
    },

    async regenerateItinerary(
        itineraryId: string,
        userId: string,
        input: RegenerateInput
    ): Promise<{
        itinerary: any;
        pdfBuffer: Buffer;
    }> {
        const existing =
            await itineraryRepository
                .findByIdForUser(
                    itineraryId,
                    userId
                );

        if (!existing) {
            throw new Error(
                "Itinerary not found"
            );
        }

        const previousItinerary =
            existing.itineraryData as any;

        if (!previousItinerary) {
            throw new Error(
                "No existing itinerary to regenerate"
            );
        }

        const regenerated =
            await itineraryAI.regenerateItinerary(
                previousItinerary,
                input.modifications,
                userId
            );

        /*
         * Regeneration returns canonical format, unlike direct generation,
         * but its own budgetBreakdown.total is still the model's word for
         * it - recompute the same way generateDirectItinerary does, before
         * validating, so a regenerated trip can't save a total that doesn't
         * match the sum of its own line items.
         */
        const verdictInput: DirectItineraryInput =
            (existing.userAnswers as DirectItineraryInput | null) ??
            ({
                destination: regenerated.destination || previousItinerary.destination,
                startDate: regenerated.startDate || previousItinerary.startDate,
                endDate: regenerated.endDate || previousItinerary.endDate,
            } as DirectItineraryInput);

        recalculateBudgetTotal(regenerated, verdictInput);

        const validated =
            ItineraryOutputSchema.parse(
                regenerated
            );

        await itineraryRepository
            .updateForUser(
                itineraryId,
                userId,
                {
                    itineraryData:
                        validated as any,

                    totalBudget:
                        String(
                            validated
                                .budgetBreakdown
                                .total
                        ),

                    status:
                        "completed",
                }
            );

        const pdfBuffer =
            await generateItineraryPdf(
                validated
            );

        return {
            itinerary:
                validated,

            pdfBuffer,
        };
    },

    async updateItinerary(
        id: string,
        userId: string,
        fields: {
            title?: string;
            status?: string;
            itineraryData?: any;
        }
    ) {
        return itineraryRepository
            .updateForUser(
                id,
                userId,
                fields
            );
    },
};