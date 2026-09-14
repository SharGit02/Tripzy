import { z } from "zod";

export const predictFareSchema = z
    .object({
        origin: z.string().trim().min(2).max(60),
        destination: z.string().trim().min(2).max(60),
        // Kept as a plain YYYY-MM-DD string end to end (ML service and DB both
        // want the same format) rather than coercing to a Date here.
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
        // Capped tighter than the ML service's own limit (90) — that headroom
        // exists for a future preset change without touching Python; this is
        // the actual product-facing cap.
        windowDays: z.coerce.number().int().min(1).max(90).default(30),
    })
    .refine((data) => data.origin.trim().toLowerCase() !== data.destination.trim().toLowerCase(), {
        message: "Origin and destination must differ.",
        path: ["destination"],
    });

export type PredictFareInput = z.infer<typeof predictFareSchema>;
