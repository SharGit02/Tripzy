import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
    itineraries,
    itineraryQuestions,
    type ItineraryRow,
    type NewItineraryRow,
    type ItineraryQuestionRow,
    type NewItineraryQuestionRow,
} from "../../db/schema.js";

export const itineraryRepository = {
    async create(userId: string, input: Omit<NewItineraryRow, "id" | "userId" | "createdAt" | "updatedAt">): Promise<ItineraryRow> {
        const [itinerary] = await db
            .insert(itineraries)
            .values({ ...input, userId } as NewItineraryRow)
            .returning();
        return itinerary;
    },

    async findByIdForUser(id: string, userId: string): Promise<ItineraryRow | undefined> {
        const [itinerary] = await db
            .select()
            .from(itineraries)
            .where(and(eq(itineraries.id, id), eq(itineraries.userId, userId)))
            .limit(1);
        return itinerary;
    },

    async findById(id: string): Promise<ItineraryRow | undefined> {
        const [itinerary] = await db.select().from(itineraries).where(eq(itineraries.id, id)).limit(1);
        return itinerary;
    },

    async findAllByUserId(userId: string, limit = 20, offset = 0): Promise<ItineraryRow[]> {
        return db
            .select()
            .from(itineraries)
            .where(eq(itineraries.userId, userId))
            .orderBy(desc(itineraries.createdAt))
            .limit(limit)
            .offset(offset);
    },

    async countByUserId(userId: string): Promise<number> {
        const result = await db
            .select({ count: itineraries.id })
            .from(itineraries)
            .where(eq(itineraries.userId, userId));
        return result.length;
    },

    async updateForUser(
        id: string,
        userId: string,
        fields: Partial<Omit<NewItineraryRow, "id" | "userId" | "createdAt" | "updatedAt">>
    ): Promise<ItineraryRow | undefined> {
        const [itinerary] = await db
            .update(itineraries)
            .set({ ...fields, updatedAt: new Date() })
            .where(and(eq(itineraries.id, id), eq(itineraries.userId, userId)))
            .returning();
        return itinerary;
    },

    async deleteForUser(id: string, userId: string): Promise<boolean> {
        const result = await db
            .delete(itineraries)
            .where(and(eq(itineraries.id, id), eq(itineraries.userId, userId)))
            .returning({ id: itineraries.id });
        return result.length > 0;
    },

    async saveQuestions(
        itineraryId: string,
        questions: Array<Omit<NewItineraryQuestionRow, "id" | "itineraryId" | "createdAt">>
    ): Promise<ItineraryQuestionRow[]> {
        if (questions.length === 0) return [];
        return db
            .insert(itineraryQuestions)
            .values(questions.map((q) => ({ ...q, itineraryId })))
            .returning();
    },

    async getQuestionsByItineraryId(itineraryId: string): Promise<ItineraryQuestionRow[]> {
        return db
            .select()
            .from(itineraryQuestions)
            .where(eq(itineraryQuestions.itineraryId, itineraryId))
            .orderBy(itineraryQuestions.step);
    },

    async updateAnswer(questionId: string, answer: unknown): Promise<ItineraryQuestionRow | undefined> {
        const [question] = await db
            .update(itineraryQuestions)
            .set({ answer: answer as any })
            .where(eq(itineraryQuestions.id, questionId))
            .returning();
        return question;
    },

    async saveAnswer(
        itineraryId: string,
        step: number,
        answer: unknown
    ): Promise<ItineraryQuestionRow | undefined> {
        const [question] = await db
            .update(itineraryQuestions)
            .set({ answer: answer as any })
            .where(and(eq(itineraryQuestions.itineraryId, itineraryId), eq(itineraryQuestions.step, step)))
            .returning();
        return question;
    },

    async deleteQuestionsByItineraryId(itineraryId: string): Promise<number> {
        const result = await db
            .delete(itineraryQuestions)
            .where(eq(itineraryQuestions.itineraryId, itineraryId))
            .returning({ id: itineraryQuestions.id });
        return result.length;
    },
};