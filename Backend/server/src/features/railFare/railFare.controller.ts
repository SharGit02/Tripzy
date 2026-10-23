import type { NextFunction, Request, Response } from "express";
import { predictRailFareSchema } from "./railFare.schema.js";
import { predictRailFareWindow } from "./railFare.service.js";

/**
 * Unlike flight fares, a rail prediction is NOT persisted: the only consumer is
 * the itinerary's rail section, which stores the train the traveller actually
 * ticked inside `itineraryData.selections.trains` (see ADR 0005). There is no
 * rail history screen, so there is nothing a `rail_fare_predictions` table
 * would be read back for - add one when a history view is actually asked for.
 */
export async function predictRailFare(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
        res.status(401).json({ message: "Authentication required." });
        return;
    }

    const parsed = predictRailFareSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: "Invalid rail fare search.", errors: parsed.error.flatten().fieldErrors });
        return;
    }

    try {
        const prediction = await predictRailFareWindow(parsed.data);
        res.status(200).json({ prediction });
    } catch (error) {
        // Already tagged with a status code by the service (422 unknown
        // station, 503 misconfigured/unreachable, 502 upstream).
        next(error);
    }
}
