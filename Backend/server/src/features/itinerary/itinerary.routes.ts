import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import * as ctrl from "./itinerary.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/generate", ctrl.generateDirectItinerary);
router.get("/", ctrl.listItineraries);
router.get("/:id", ctrl.getItinerary);
router.get("/:id/pdf", ctrl.downloadPdf);
router.post("/:id/email-pdf", ctrl.emailPdf);
router.post("/:id/regenerate", ctrl.regenerateItinerary);
router.patch("/:id", ctrl.updateItinerary);
router.delete("/:id", ctrl.deleteItinerary);

export default router;
