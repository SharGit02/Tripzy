import { z } from "zod";

// Station/city names, not codes: the rail model is trained on full station
// names ("NEW DELHI", "MADGAON") and the ML service canonicalizes a city the
// traveller typed onto one of them, so this stays a free-text name like the
// flight schema's origin/destination.
export const predictRailFareSchema = z
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

export type PredictRailFareInput = z.infer<typeof predictRailFareSchema>;
