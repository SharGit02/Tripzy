import { z } from "zod";

// City names, not codes: the bus model canonicalizes a city the traveller
// typed onto one of its trained cities (or falls back to a generic estimate
// for one it doesn't recognise - see bus_predictor.py), so this stays a
// free-text name like the flight and rail schemas' origin/destination.
export const predictBusFareSchema = z
    .object({
        origin: z.string().trim().min(2).max(80),
        destination: z.string().trim().min(2).max(80),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
        windowDays: z.coerce.number().int().min(1).max(90).default(30),
    })
    .refine((data) => data.origin.trim().toLowerCase() !== data.destination.trim().toLowerCase(), {
        message: "Origin and destination must differ.",
        path: ["destination"],
    });

export type PredictBusFareInput = z.infer<typeof predictBusFareSchema>;
