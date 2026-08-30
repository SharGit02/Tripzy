import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { flightFareRateLimiter } from "../../middlewares/rateLimit.middleware.js";
import { predictFlightFare, listFlightFareHistory, getFlightFarePrediction } from "./flightFare.controller.js";

const router = Router();

// All routes gated: unlike weather, predictions are persisted per-user, so
// this follows bookings/search-history's auth-everywhere convention.
router.post("/predict", authMiddleware, flightFareRateLimiter, predictFlightFare);
// Static "/history" must be registered before the "/:id" param route, or
// Express would match "history" as an :id.
router.get("/history", authMiddleware, listFlightFareHistory);
router.get("/:id", authMiddleware, getFlightFarePrediction);

export default router;
