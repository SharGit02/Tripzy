import type { NextFunction, Request, Response } from "express";
import { predictFareSchema } from "./flightFare.schema.js";
import { predictFareWindow } from "./flightFare.service.js";
import { flightFareRepository } from "./flightFare.repository.js";

export async function predictFlightFare(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
        res.status(401).json({ message: "Authentication required." });
        return;
    }

    const parsed = predictFareSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: "Invalid flight fare search.", errors: parsed.error.flatten().fieldErrors });
        return;
    }

    try {
        const result = await predictFareWindow(parsed.data);

        const prediction = await flightFareRepository.create(req.user.userId, {
            origin: result.origin,
            destination: result.destination,
            searchStartDate: result.startDate,
            windowDays: result.windowDays,
            bestDate: result.best?.date ?? null,
            bestAirline: result.best?.airline ?? null,
            bestFlightNumber: result.best?.flightNumber ?? null,
            bestPredictedFare: result.best ? String(result.best.predictedFare) : null,
            results: { quotes: result.quotes, daysWithNoFlights: result.daysWithNoFlights },
        });

        res.status(201).json({ prediction });
    } catch (error) {
        // The service throws errors already tagged with the right status code
        // (422 unknown route, 503 misconfigured/unreachable, 502 upstream
        // error), so the shared error middleware can render them as-is.
        next(error);
    }
}

export async function listFlightFareHistory(req: Request, res: Response): Promise<void> {
    if (!req.user) {
        res.status(401).json({ message: "Authentication required." });
        return;
    }

    const history = await flightFareRepository.findAllByUserId(req.user.userId);
    res.status(200).json({ history });
}

export async function getFlightFarePrediction(req: Request, res: Response): Promise<void> {
    if (!req.user) {
        res.status(401).json({ message: "Authentication required." });
        return;
    }

    const prediction = await flightFareRepository.findByIdForUser(String(req.params.id), req.user.userId);
    if (!prediction) {
        res.status(404).json({ message: "Fare prediction not found." });
        return;
    }

    res.status(200).json({ prediction });
}
