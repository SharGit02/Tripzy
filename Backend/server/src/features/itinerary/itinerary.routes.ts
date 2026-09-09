import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import * as ctrl from "./itinerary.controller.js";

const router = Router();

router.use(authMiddleware);

// Mounted at /api/plan (and aliased at /api/itinerary).

router.post("/questions", ctrl.getQuestions);
router.post("/:itineraryId/answers", ctrl.submitAnswer);
router.post("/generate", ctrl.generateDirectItinerary);
router.get("/", ctrl.listItineraries);
router.get("/:id", ctrl.getItinerary);
router.get("/:id/pdf", ctrl.downloadPdf);
router.post("/:id/regenerate", ctrl.regenerateItinerary);
router.patch("/:id", ctrl.updateItinerary);
router.delete("/:id", ctrl.deleteItinerary);

export default router;