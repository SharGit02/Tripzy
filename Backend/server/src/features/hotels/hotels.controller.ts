import type { NextFunction, Request, Response } from "express";
import { HotelSearchQuerySchema } from "./hotels.schema.js";
import { getHotels } from "./hotels.service.js";

export async function searchHotels(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = HotelSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({
            message: "Invalid hotel search.",
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }

    try {
        const { hotels, cached } = await getHotels(parsed.data);
        res.status(200).json({ hotels, cached, total: hotels.length });
    } catch (error) {
        // The service tags its errors with a status code (503 unconfigured key,
        // 429 quota, 504 timeout) for the shared error middleware to render.
        next(error);
    }
}
