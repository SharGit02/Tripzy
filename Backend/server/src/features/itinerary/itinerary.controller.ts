import type { Request, Response } from "express";
import { z } from "zod";
import { itineraryService } from "./itinerary.service.js";
import { generateItineraryPdf } from "../../services/pdf/pdf.service.js";
import { formatItineraryForDisplay } from "./itinerary.formatter.js";
import {
    DirectItineraryInputSchema,
    ItineraryDayPatchSchema,
    ItinerarySelectionsSchema,
    RegenerateInputSchema,
    formatZodError,
} from "./itinerary.schema.js";
import { presentItinerary, presentItineraryListItem } from "./itinerary.presenter.js";
import { GeminiContentError } from "../../services/ai/gemini.provider.js";

function itineraryIdParam(req: Request): string {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    return String(id || "");
}

/** Shared mapping from a thrown generation error to an HTTP status + body, used by both the plain-JSON and SSE response paths below. */
function describeGenerateError(error: unknown): { statusCode: number; body: Record<string, unknown> } {
    if (error instanceof z.ZodError) {
        return {
            statusCode: 422,
            body: {
                message: "We couldn't finish that itinerary. Try a shorter trip or different dates.",
                errors: error.flatten().fieldErrors,
            },
        };
    }
    if (error instanceof GeminiContentError) {
        return { statusCode: error.statusCode ?? 422, body: { message: error.message } };
    }
    if (error instanceof Error && (error.message.includes("API key") || error.message.includes("not configured"))) {
        return {
            statusCode: 503,
            body: { message: "The trip planner isn't configured right now. Please try again later." },
        };
    }
    return { statusCode: 500, body: { message: "We couldn't create your itinerary. Please try again." } };
}

export async function generateDirectItinerary(req: Request, res: Response): Promise<void> {
    const parsed = DirectItineraryInputSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(formatZodError(parsed.error));
        return;
    }

    // The generating page wants real progress, not just a blocking spinner.
    // Opt-in via Accept so every other caller (regenerate, tests, curl) keeps
    // getting the plain JSON response unchanged.
    const wantsStream = (req.headers.accept || "").includes("text/event-stream");

    if (!wantsStream) {
        try {
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
            const { statusCode, body } = describeGenerateError(error);
            res.status(statusCode).json(body);
        }
        return;
    }

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
    });
    const send = (event: Record<string, unknown>) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
        const { itineraryId } = await itineraryService.generateDirectItinerary(
            parsed.data,
            req.user!.userId,
            (stage) => send({ stage }),
        );
        const saved = await itineraryService.getItinerary(itineraryId, req.user!.userId);
        send({
            stage: "done",
            itineraryId,
            itinerary: presentItinerary(saved),
            message: "Itinerary generated successfully",
            pdfAvailable: true,
        });
    } catch (error) {
        console.error("Generate direct itinerary error:", error);
        send({ stage: "error", ...describeGenerateError(error).body });
    } finally {
        res.end();
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
            from: "Tripzy <hello@tripzy.varadraut.dev>", // using verified custom domain
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

/*
 * Note what is NOT here: `itineraryData`.
 *
 * It used to be accepted as `z.any()`, which let any authenticated user
 * overwrite the entire stored document for their own itinerary — including
 * the accommodation `bookingLink` / `imageUrl` and place `imageUrl` fields
 * that are rendered into href/src attributes. Because an itinerary is
 * publicly shareable (/share/:id), that turned a self-service write into
 * stored XSS against anyone opening the share link, and it also let a client
 * write a document shape that bypasses every generator-side invariant.
 *
 * No client ever sent it: the day editor sends `days`, the checkboxes send
 * `selections`. So the field is simply gone, and the two legitimate shapes
 * are validated structurally instead.
 */
const UpdateItineraryBodySchema = z
    .object({
        title: z.string().trim().min(1).max(200).optional(),
        status: z.enum(["draft", "completed", "archived"]).optional(),
        days: z.array(ItineraryDayPatchSchema).max(60).optional(),
        // Which items the traveler ticked. Patched on its own so toggling a
        // checkbox never has to round-trip the whole itinerary document.
        selections: ItinerarySelectionsSchema.optional(),
    })
    .refine((body) => Object.values(body).some((value) => value !== undefined), {
        message: "Nothing to update.",
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
        // Always rebuilt from the stored document, never taken from the
        // request, so a patch can only ever change `days` and `selections`.
        let itineraryData: Record<string, unknown> | undefined;
        if (parsed.data.days) {
            itineraryData = { ...current, days: parsed.data.days };
        }
        // Merged onto whatever the document already is — including a
        // `days` patch arriving in the same request — so a selection change
        // never silently drops the rest of the itinerary.
        if (parsed.data.selections) {
            itineraryData = {
                ...(itineraryData ?? current),
                selections: {
                    ...parsed.data.selections,
                    updatedAt: new Date().toISOString(),
                },
            };
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
