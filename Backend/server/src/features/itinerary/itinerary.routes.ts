import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
    itineraryExportRateLimiter,
    itineraryGenerateRateLimiter,
} from "../../middlewares/rateLimit.middleware.js";
import * as ctrl from "./itinerary.controller.js";

const router = Router();

router.use(authMiddleware);

// The limiters sit after authMiddleware (mounted above) so they can key on
// the authenticated user id rather than the request IP.
router.post("/generate", itineraryGenerateRateLimiter, ctrl.generateDirectItinerary);
router.get("/", ctrl.listItineraries);
router.get("/:id", ctrl.getItinerary);
router.get("/:id/pdf", itineraryExportRateLimiter, ctrl.downloadPdf);
router.post("/:id/email-pdf", itineraryExportRateLimiter, ctrl.emailPdf);
// Regeneration is a second AI call, so it shares the generation budget.
router.post("/:id/regenerate", itineraryGenerateRateLimiter, ctrl.regenerateItinerary);
router.patch("/:id", ctrl.updateItinerary);
router.delete("/:id", ctrl.deleteItinerary);

export default router;
