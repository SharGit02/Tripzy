import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
    flightFarePredictions,
    type FlightFarePredictionRow,
    type NewFlightFarePredictionRow,
} from "../../db/schema.js";

export const flightFareRepository = {
    async findAllByUserId(userId: string, limit = 20): Promise<FlightFarePredictionRow[]> {
        return db
            .select()
            .from(flightFarePredictions)
            .where(eq(flightFarePredictions.userId, userId))
            .orderBy(desc(flightFarePredictions.createdAt))
            .limit(limit);
    },

    async findByIdForUser(id: string, userId: string): Promise<FlightFarePredictionRow | undefined> {
        const [row] = await db
            .select()
            .from(flightFarePredictions)
            .where(and(eq(flightFarePredictions.id, id), eq(flightFarePredictions.userId, userId)))
            .limit(1);
        return row;
    },

    async create(
        userId: string,
        input: Omit<NewFlightFarePredictionRow, "id" | "userId" | "createdAt">
    ): Promise<FlightFarePredictionRow> {
        const [row] = await db
            .insert(flightFarePredictions)
            .values({ ...input, userId })
            .returning();
        return row;
    },
};
