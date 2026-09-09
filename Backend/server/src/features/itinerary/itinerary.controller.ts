import type { Request, Response } from "express";
import { z } from "zod";
import { itineraryService } from "./itinerary.service.js";
import { itineraryRepository } from "./itinerary.repository.js";
import { generateItineraryPdf } from "../../services/pdf/pdf.service.js";
import { formatItineraryForDisplay } from "./itinerary.formatter.js";
import {
    GenerateQuestionsInputSchema,
    DirectItineraryInputSchema,
    RegenerateInputSchema,
    formatZodError,
} from "./itinerary.schema.js";
import { GeminiContentError } from "../../services/ai/gemini.provider.js";

export async function getQuestions(req: Request, res: Response): Promise<void> {
    try {
        const parsed = GenerateQuestionsInputSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json(formatZodError(parsed.error));
            return;
        }

        console.log("[QUESTIONS] Generating questions for:", parsed.data);
        const { questions, itineraryId } = await itineraryService.generateQuestions(parsed.data, req.user!.userId);
        console.log("[QUESTIONS] Success:", { questionsCount: questions.length, itineraryId });
        res.json({ questions, itineraryId });
    } catch (error) {
        console.error("[QUESTIONS] Error:", error);
        if (error instanceof Error && error.message.includes("API key")) {
            res.status(503).json({ message: "AI service not configured" });
            return;
        }
        res.status(500).json({ message: "Failed to generate questions", error: error instanceof Error ? error.message : "Unknown error" });
    }
}

export async function submitAnswer(req: Request, res: Response): Promise<void> {
    try {
        const itineraryId = Array.isArray(req.params.itineraryId) ? req.params.itineraryId[0] : req.params.itineraryId;
        const { step, answer } = req.body;

        if (!step || answer === undefined) {
            res.status(400).json({ message: "Step and answer are required" });
            return;
        }

        const question = await itineraryService.submitAnswer(itineraryId, Number(step), answer, req.user!.userId);
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

export async function generateDirectItinerary(req: Request, res: Response): Promise<void> {
    try {
        const parsed = DirectItineraryInputSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json(formatZodError(parsed.error));
            return;
        }

        const { itinerary, itineraryId } =
            await itineraryService.generateDirectItinerary(
                parsed.data,
                req.user!.userId
            );

        res.setHeader("X-Itinerary-ID", itineraryId);
        res.setHeader("Content-Type", "application/json");

        res.json({
            itinerary,
            itineraryId,
            message: "Itinerary generated successfully",
            pdfAvailable: true,
        });
    } catch (error) {
        console.error("Generate direct itinerary error:", error);
        if (error instanceof z.ZodError) {
            res.status(422).json({
                message: "We couldn't finish that itinerary. Try a shorter trip or different dates.",
                errors: error.flatten().fieldErrors,
            });
            return;
        }
        if (error instanceof GeminiContentError) {
            res.status(error.statusCode ?? 422).json({ message: error.message });
            return;
        }
        if (error instanceof Error) {
            if (error.message.includes("API key") || error.message.includes("not configured")) {
                res.status(503).json({ message: "The trip planner isn't configured right now. Please try again later." });
                return;
            }
        }
        res.status(500).json({ message: "We couldn't create your itinerary. Please try again." });
    }
}

export async function downloadPdf(req: Request, res: Response): Promise<void> {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        if (!id || id === "undefined") {
            res.status(400).json({
                message: "Invalid itinerary ID",
            });
            return;
        }

        // Additional safety check - ensure it's a valid UUID format
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(id)) {
            res.status(400).json({
                message: "Invalid itinerary ID format",
            });
            return;
        }

        const saved = await itineraryService.getItinerary(id, req.user!.userId);
        if (!saved) {
            res.status(404).json({
                message: "Itinerary not found",
            });
            return;
        }

        const pdfBuffer = await generateItineraryPdf(saved.itineraryData as any);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${String(saved.destination).replace(/\s+/g, "-")}-itinerary.pdf"`
        );
        res.send(pdfBuffer);
        return;
    } catch (error) {
        console.error("PDF download error:", error);
        res.status(500).json({ message: "Failed to generate PDF" });
    }
}

export async function listItineraries(req: Request, res: Response): Promise<void> {
    try {
        const limit = Math.min(Number(req.query.limit) || 20, 50);
        const offset = Number(req.query.offset) || 0;
        const { itineraries, total } = await itineraryService.listItineraries(req.user!.userId, limit, offset);
        res.json({ itineraries, total, limit, offset });
    } catch (error) {
        console.error("List itineraries error:", error);
        res.status(500).json({ message: "Failed to fetch itineraries" });
    }
}

export async function getItinerary(req: Request, res: Response): Promise<void> {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const itinerary = await itineraryService.getItinerary(id, req.user!.userId);
        if (!itinerary) {
            res.status(404).json({ message: "Itinerary not found" });
            return;
        }
        res.json({ itinerary });
    } catch (error) {
        console.error("Get itinerary error:", error);
        res.status(500).json({ message: "Failed to fetch itinerary" });
    }
}

export async function regenerateItinerary(req: Request, res: Response): Promise<void> {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const parsed = RegenerateInputSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json(formatZodError(parsed.error));
            return;
        }

        const { itinerary, pdfBuffer } = await itineraryService.regenerateItinerary(id, req.user!.userId, parsed.data);

        const formattedOutput = formatItineraryForDisplay(itinerary);

        res.json({ itinerary, formattedOutput, message: "Itinerary regenerated successfully" });
    } catch (error) {
        console.error("Regenerate error:", error);
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                res.status(404).json({ message: error.message });
                return;
            }
            if (error.message.includes("API key")) {
                res.status(503).json({ message: "The trip planner isn't configured right now. Please try again later." });
                return;
            }
        }
        res.status(500).json({ message: "Failed to regenerate itinerary" });
    }
}

export async function updateItinerary(req: Request, res: Response): Promise<void> {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { title, status } = req.body;
        const updated = await itineraryService.updateItinerary(id, req.user!.userId, { title, status });
        if (!updated) {
            res.status(404).json({ message: "Itinerary not found" });
            return;
        }
        res.json({ itinerary: updated });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ message: "Failed to update itinerary" });
    }
}

export async function deleteItinerary(req: Request, res: Response): Promise<void> {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const deleted = await itineraryService.deleteItinerary(id, req.user!.userId);
        if (!deleted) {
            res.status(404).json({ message: "Itinerary not found" });
            return;
        }
        res.json({ message: "Itinerary deleted" });
    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ message: "Failed to delete itinerary" });
    }
}