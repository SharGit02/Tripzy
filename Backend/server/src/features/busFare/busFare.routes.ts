import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { flightFareRateLimiter } from "../../middlewares/rateLimit.middleware.js";
import { predictBusFare } from "./busFare.controller.js";

const router = Router();

// Shares flightFareRateLimiter: same ML process behind all three transport
// endpoints, so the budget that protects it is the same budget.
router.post("/predict", authMiddleware, flightFareRateLimiter, predictBusFare);

export default router;
