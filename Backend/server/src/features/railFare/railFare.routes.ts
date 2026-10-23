import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { flightFareRateLimiter } from "../../middlewares/rateLimit.middleware.js";
import { predictRailFare } from "./railFare.controller.js";

const router = Router();

// Shares flightFareRateLimiter: same ML process behind both endpoints, so the
// budget that protects it is the same budget.
router.post("/predict", authMiddleware, flightFareRateLimiter, predictRailFare);

export default router;
