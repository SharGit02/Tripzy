import { z } from "zod";

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
});

export const ItineraryAccommodationSchema = z.object({
    name: z.string(),
    type: z.enum(["hotel", "flat", "hostel", "resort", "homestay"]),
    pricePerNight: z.number().positive(),
    currency: z.string().default("INR"),
    location: z.string(),
    amenities: z.array(z.string()),
    description: z.string(),
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
    accommodations: z.array(z.object({
        name: z.string(),
        type: z.enum(["hotel", "flat", "hostel", "resort", "homestay"]),
        pricePerNight: z.number().positive(),
        currency: z.string().default("INR"),
        location: z.string(),
        amenities: z.array(z.string()),
        description: z.string(),
    })).min(1).max(3),
    placesToVisit: z.array(z.object({
        name: z.string(),
        description: z.string(),
        category: z.string(),
        location: z.string(),
        visitDurationHours: z.number().positive(),
        bestTimeToVisit: z.string(),
        priceRange: z.string().optional(),
    })).min(3).max(10),
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
    generatedAt: z.string().datetime().optional(),
    version: z.string().default("1.0"),
});

export const DirectItineraryInputSchema = z.object({
    destination: z.string().min(2).max(150),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    adults: z.number().int().positive().default(2),
    children: z.number().int().nonnegative().default(0),
    rooms: z.number().int().positive().default(1),
    accommodationType: AccommodationTypeSchema.default("standard"),
    preferredTransport: TransportModeSchema.optional(),
    tripType: TripTypeSchema.default("couple"),
    interests: z.array(z.enum(["nature", "adventure", "beaches", "spiritual", "shopping", "food", "wildlife", "history"])).default([]),
    wheelchairAccessible: z.boolean().default(false),
    travelStyle: TravelStyleSchema.default("balanced"),
    specialRequests: z.string().max(2000).optional(),
    budget: z.number().positive().optional(),
});

export const RegenerateInputSchema = z.object({
    modifications: z.string().min(10).max(2000),
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
export type ItineraryTransport = z.infer<typeof ItineraryTransportSchema>;
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;
export type ItineraryDayActivity = z.infer<typeof ItineraryDayActivitySchema>;
export type BudgetBreakdown = z.infer<typeof BudgetBreakdownSchema>;
export type DirectItineraryInput = z.infer<typeof DirectItineraryInputSchema>;
export type RegenerateInput = z.infer<typeof RegenerateInputSchema>;
export type ItineraryResponse = z.infer<typeof ItineraryResponseSchema>;
export type GenerateQuestionsInput = z.infer<typeof GenerateQuestionsInputSchema>;