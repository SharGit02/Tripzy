/**
 * FUTURE USE — HTTP handlers for the questionnaire flow.
 * Do not import this from itinerary.routes.ts until the Q&A product is enabled.
 */
import type { Request, Response } from "express";
import { GenerateQuestionsInputSchema, formatZodError } from "./itinerary.schema.js";
import { itineraryQuestionnaire } from "./itinerary.questionnaire.future.js";

export async function getQuestions(req: Request, res: Response): Promise<void> {
    try {
        const parsed = GenerateQuestionsInputSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json(formatZodError(parsed.error));
            return;
        }

        const { questions, itineraryId } = await itineraryQuestionnaire.generateQuestions(
            parsed.data,
            req.user!.userId,
        );
        res.json({ questions, itineraryId });
    } catch (error) {
        console.error("[QUESTIONS] Error:", error);
        res.status(500).json({
            message: "Failed to generate questions",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}

export async function submitAnswer(req: Request, res: Response): Promise<void> {
    try {
        const itineraryId = Array.isArray(req.params.itineraryId)
            ? req.params.itineraryId[0]
            : req.params.itineraryId;
        const { step, answer } = req.body;

        if (!step || answer === undefined) {
            res.status(400).json({ message: "Step and answer are required" });
            return;
        }

        const question = await itineraryQuestionnaire.submitAnswer(
            itineraryId,
            Number(step),
            answer,
            req.user!.userId,
        );
        if (!question) {
            res.status(404).json({ message: "Itinerary or question not found" });
            return;
        }

        res.json({ question });
    } catch (error) {
        console.error("Submit answer error:", error);
        res.status(500).json({ message: "Failed to submit answer" });
    }
}
