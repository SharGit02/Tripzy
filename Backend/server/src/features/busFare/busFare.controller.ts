import type { NextFunction, Request, Response } from "express";
import { predictBusFareSchema } from "./busFare.schema.js";
import { predictBusFareWindow } from "./busFare.service.js";

/**
 * Same story as rail (see railFare.controller.ts): not persisted. A chosen
 * bus belongs in `itineraryData.selections.*` once the itinerary UI supports
 * picking one, not in a history table nothing reads back yet.
 */
export async function predictBusFare(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
        res.status(401).json({ message: "Authentication required." });
        return;
    }

    const parsed = predictBusFareSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: "Invalid bus fare search.", errors: parsed.error.flatten().fieldErrors });
        return;
    }

    try {
        const prediction = await predictBusFareWindow(parsed.data);
        res.status(200).json({ prediction });
    } catch (error) {
        // Already tagged with a status code by the service (422 same city,
        // 503 misconfigured/unreachable, 502 upstream).
        next(error);
    }
}
