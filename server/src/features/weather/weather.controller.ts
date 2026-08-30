import type { NextFunction, Request, Response } from "express";
import { weatherQuerySchema } from "./weather.schema.js";
import { getWeatherForCity } from "./weather.service.js";

export async function getWeather(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = weatherQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({
            message: "Invalid weather request.",
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }

    try {
        const weather = await getWeatherForCity(parsed.data.city);
        res.status(200).json({ weather });
    } catch (error) {
        // The service throws errors already tagged with the right status code
        // (404 unknown city, 503 misconfigured key, 504 upstream timeout), so
        // the shared error middleware can render them as-is.
        next(error);
    }
}
