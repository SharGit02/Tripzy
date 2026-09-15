import type { Request, Response } from "express";
import { z } from "zod";
import { itineraryService } from "./itinerary.service.js";
import { generateItineraryPdf } from "../../services/pdf/pdf.service.js";
import { formatItineraryForDisplay } from "./itinerary.formatter.js";
import {
    DirectItineraryInputSchema,
    RegenerateInputSchema,
    formatZodError,
} from "./itinerary.schema.js";
import { presentItinerary, presentItineraryListItem } from "./itinerary.presenter.js";
import { GeminiContentError } from "../../services/ai/gemini.provider.js";

function itineraryIdParam(req: Request): string {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    return String(id || "");
}

export async function generateDirectItinerary(req: Request, res: Response): Promise<void> {
    try {
        const parsed = DirectItineraryInputSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json(formatZodError(parsed.error));
            return;
        }

        const { itineraryId } =
            await itineraryService.generateDirectItinerary(parsed.data, req.user!.userId);
        const saved = await itineraryService.getItinerary(itineraryId, req.user!.userId);

        res.setHeader("X-Itinerary-ID", itineraryId);
        res.json({
            itinerary: presentItinerary(saved),
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
                res.status(503).json({
                    message: "The trip planner isn't configured right now. Please try again later.",
                });
                return;
            }
        }
        res.status(500).json({ message: "We couldn't create your itinerary. Please try again." });
    }
}

export async function downloadPdf(req: Request, res: Response): Promise<void> {
    try {
        const id = itineraryIdParam(req);
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!id || !uuidPattern.test(id)) {
            res.status(400).json({ message: "Invalid itinerary ID" });
            return;
        }

        const saved = await itineraryService.getItinerary(id, req.user!.userId);
        if (!saved) {
            res.status(404).json({ message: "Itinerary not found" });
            return;
        }

        const presented = presentItinerary(saved);
        const pdfBuffer = await generateItineraryPdf(presented as any);

        const filename = `${String(saved.destination).replace(/[^a-zA-Z0-9\-_]/g, "-")}-itinerary.pdf`;

        // Set all headers BEFORE sending the body to prevent connection resets.
        // Content-Length is critical: without it, some clients (curl, fetch)
        // treat the stream as chunked and can misread the boundary, causing
        // exit code 56 / connection reset errors.
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Length", pdfBuffer.length);
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.status(200).end(pdfBuffer);
    } catch (error) {
        console.error("PDF download error:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Failed to generate PDF" });
        }
    }
}

export async function emailPdf(req: Request, res: Response): Promise<void> {
    try {
        const id = itineraryIdParam(req);
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!id || !uuidPattern.test(id)) {
            res.status(400).json({ message: "Invalid itinerary ID" });
            return;
        }

        const saved = await itineraryService.getItinerary(id, req.user!.userId);
        if (!saved) {
            res.status(404).json({ message: "Itinerary not found" });
            return;
        }

        const presented = presentItinerary(saved);
        const pdfBuffer = await generateItineraryPdf(presented as any);

        const filename = `${String(saved.destination).replace(/[^a-zA-Z0-9\-_]/g, "-")}-itinerary.pdf`;
        
        const { env } = await import("../../config/env.js");
        if (!env.RESEND_API_KEY) {
            res.status(503).json({ message: "Email service is not configured." });
            return;
        }

        const { Resend } = await import("resend");
        const resend = new Resend(env.RESEND_API_KEY);

        const userEmail = req.user!.email;
        if (!userEmail) {
            res.status(400).json({ message: "User email not found in session." });
            return;
        }

        await resend.emails.send({
            from: "Tripzy <onboarding@resend.dev>", // default verified sender
            to: [userEmail],
            subject: `Your trip itinerary to ${saved.destination}`,
            text: `Hi there!\n\nAttached is your Tripzy itinerary for ${saved.destination}.\n\nHave a great trip!`,
            attachments: [
                {
                    filename,
                    content: pdfBuffer,
                },
            ],
        });

        res.json({ message: "Itinerary sent to your email!" });
    } catch (error) {
        console.error("Email PDF error:", error);
        res.status(500).json({ message: "Failed to email PDF" });
    }
}

export async function listItineraries(req: Request, res: Response): Promise<void> {
    try {
        const limit = Math.min(Number(req.query.limit) || 20, 50);
        const offset = Number(req.query.offset) || 0;
        const { itineraries, total } = await itineraryService.listItineraries(
            req.user!.userId,
            limit,
            offset,
        );
        res.json({
            itineraries: itineraries.map(presentItineraryListItem),
            total,
            limit,
            offset,
        });
    } catch (error) {
        console.error("List itineraries error:", error);
        res.status(500).json({ message: "Failed to fetch itineraries" });
    }
}

export async function getItinerary(req: Request, res: Response): Promise<void> {
    try {
        const saved = await itineraryService.getItinerary(itineraryIdParam(req), req.user!.userId);
        if (!saved) {
            res.status(404).json({ message: "Itinerary not found" });
            return;
        }
        res.json({ itinerary: presentItinerary(saved), itineraryId: saved.id });
    } catch (error) {
        console.error("Get itinerary error:", error);
        res.status(500).json({ message: "Failed to fetch itinerary" });
    }
}

export async function getPublicItinerary(req: Request, res: Response): Promise<void> {
    try {
        const saved = await itineraryService.getItineraryById(itineraryIdParam(req));
        if (!saved) {
            res.status(404).json({ message: "Itinerary not found" });
            return;
        }
        res.json({ itinerary: presentItinerary(saved), itineraryId: saved.id });
    } catch (error) {
        console.error("Get public itinerary error:", error);
        res.status(500).json({ message: "Failed to fetch itinerary" });
    }
}

export async function regenerateItinerary(req: Request, res: Response): Promise<void> {
    try {
        const id = itineraryIdParam(req);
        const parsed = RegenerateInputSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json(formatZodError(parsed.error));
            return;
        }

        await itineraryService.regenerateItinerary(
            id,
            req.user!.userId,
            parsed.data,
        );
        const saved = await itineraryService.getItinerary(id, req.user!.userId);

        res.json({
            itinerary: presentItinerary(saved),
            itineraryId: id,
            formattedOutput: formatItineraryForDisplay(presentItinerary(saved) as any),
            message: "Itinerary regenerated successfully",
        });
    } catch (error) {
        console.error("Regenerate error:", error);
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                res.status(404).json({ message: error.message });
                return;
            }
            if (error.message.includes("API key")) {
                res.status(503).json({
                    message: "The trip planner isn't configured right now. Please try again later.",
                });
                return;
            }
        }
        res.status(500).json({ message: "Failed to regenerate itinerary" });
    }
}

const UpdateItineraryBodySchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    status: z.string().optional(),
    itineraryData: z.any().optional(),
    days: z.array(z.any()).optional(),
});

export async function updateItinerary(req: Request, res: Response): Promise<void> {
    try {
        const id = itineraryIdParam(req);
        const parsed = UpdateItineraryBodySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json(formatZodError(parsed.error));
            return;
        }

        const saved = await itineraryService.getItinerary(id, req.user!.userId);
        if (!saved) {
            res.status(404).json({ message: "Itinerary not found" });
            return;
        }

        const current = presentItinerary(saved) || {};
        let itineraryData = parsed.data.itineraryData;
        if (parsed.data.days) {
            itineraryData = { ...current, days: parsed.data.days };
        }

        const updated = await itineraryService.updateItinerary(id, req.user!.userId, {
            title: parsed.data.title,
            status: parsed.data.status,
            itineraryData,
        });
        if (!updated) {
            res.status(404).json({ message: "Itinerary not found" });
            return;
        }
        res.json({ itinerary: presentItinerary(updated), itineraryId: updated.id });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ message: "Failed to update itinerary" });
    }
}

export async function deleteItinerary(req: Request, res: Response): Promise<void> {
    try {
        const deleted = await itineraryService.deleteItinerary(itineraryIdParam(req), req.user!.userId);
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
