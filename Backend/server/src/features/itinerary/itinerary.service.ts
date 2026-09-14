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

function buildAccommodations(
    aiOutput: any,
    input: DirectItineraryInput
): any[] {
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

                currency: String(
                    transport?.currency ||
                    "INR"
                ),
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

function buildBudget(
    aiOutput: any,
    days: any[],
    accommodations: any[],
    transportOptions: any[],
    input: DirectItineraryInput
): any {
    /*
     * 1. Explicit AI budget.
     */

    const raw =
        aiOutput?.budgetBreakdown;

    if (
        raw &&
        typeof raw === "object" &&
        !Array.isArray(raw)
    ) {
        const accommodation =
            parseCostString(
                raw.accommodation
            );

        const food =
            parseCostString(
                raw.food
            );

        const transport =
            parseCostString(
                raw.transport
            );

        const activities =
            parseCostString(
                raw.activities
            );

        const miscellaneous =
            parseCostString(
                raw.miscellaneous
            );

        const total =
            accommodation +
            food +
            transport +
            activities +
            miscellaneous;

        if (total > 0) {
            return {
                accommodation,
                food,
                transport,
                activities,
                miscellaneous,
                total,
                currency:
                    String(
                        raw.currency ||
                        "INR"
                    ),
            };
        }
    }

    /*
     * 2. User-provided budget.
     *
     * This is a target budget, not a guarantee.
     * We use it only if AI did not provide
     * category values.
     */

    if (
        input.budget &&
        input.budget > 0
    ) {
        const total =
            Math.round(
                input.budget
            );

        const accommodation =
            Math.round(
                total * 0.40
            );

        const food =
            Math.round(
                total * 0.25
            );

        const transport =
            Math.round(
                total * 0.15
            );

        const activities =
            Math.round(
                total * 0.10
            );

        const miscellaneous =
            total -
            accommodation -
            food -
            transport -
            activities;

        return {
            accommodation,
            food,
            transport,
            activities,
            miscellaneous,
            total,
            currency: "INR",
        };
    }

    /*
     * 3. Calculate from actual data.
     */

    const totalDays =
        calculateDays(
            input.startDate,
            input.endDate
        );

    const nights =
        Math.max(
            1,
            totalDays - 1
        );

    const accommodation =
        accommodations.reduce(
            (
                total: number,
                accommodation: any
            ) =>
                total +
                parseCostString(
                    accommodation.pricePerNight
                ),
            0
        ) * nights;

    const transport =
        transportOptions.reduce(
            (
                total: number,
                transport: any
            ) =>
                total +
                parseCostString(
                    transport.estimatedCost
                ),
            0
        );

    const allActivities =
        days.flatMap(
            (day: any) =>
                day.activities || []
        );

    const activities =
        allActivities
            .filter(
                (activity: any) =>
                    activity.type !==
                    "meal"
            )
            .reduce(
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

    /*
     * Food is calculated ONLY from
     * meal activities first.
     */

    const explicitMealCost =
        allActivities
            .filter(
                (activity: any) =>
                    activity.type ===
                    "meal"
            )
            .reduce(
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

    /*
     * If AI didn't provide meal costs,
     * estimate food from group size.
     */

    const people =
        input.adults +
        input.children;

    const food =
        explicitMealCost > 0
            ? explicitMealCost
            : Math.round(
                  people *
                      totalDays *
                      1200
              );

    const miscellaneous =
        Math.round(
            (
                accommodation +
                food +
                transport +
                activities
            ) * 0.05
        );

    const total =
        accommodation +
        food +
        transport +
        activities +
        miscellaneous;

    return {
        accommodation,
        food,
        transport,
        activities,
        miscellaneous,
        total,
        currency: "INR",
    };
}

/* ============================================================
   MAIN TRANSFORMER
============================================================ */

function transformItineraryOutput(
    aiOutput: any,
    input: DirectItineraryInput
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
            input
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

    const budgetBreakdown =
        buildBudget(
            aiOutput,
            days,
            accommodations,
            transportOptions,
            input
        );

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
        userId: string
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
         * AI generation
         */

        const aiOutput =
            await itineraryAI.generateDirectItinerary(
                input,
                userId
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
                input
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

        const budget =
            itinerary.budgetBreakdown;

        itinerary.budgetBreakdown =
            {
                ...budget,

                accommodation:
                    Math.max(
                        0,
                        Number(
                            budget.accommodation ||
                            0
                        )
                    ),

                food:
                    Math.max(
                        0,
                        Number(
                            budget.food ||
                            0
                        )
                    ),

                transport:
                    Math.max(
                        0,
                        Number(
                            budget.transport ||
                            0
                        )
                    ),

                activities:
                    Math.max(
                        0,
                        Number(
                            budget.activities ||
                            0
                        )
                    ),

                miscellaneous:
                    Math.max(
                        0,
                        Number(
                            budget.miscellaneous ||
                            0
                        )
                    ),
            };

        itinerary.budgetBreakdown.total =
            itinerary.budgetBreakdown
                .accommodation +
            itinerary.budgetBreakdown
                .food +
            itinerary.budgetBreakdown
                .transport +
            itinerary.budgetBreakdown
                .activities +
            itinerary.budgetBreakdown
                .miscellaneous;

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
         * Regeneration returns canonical
         * format, unlike direct generation.
         *
         * But we still validate it.
         */

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