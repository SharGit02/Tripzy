import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { hotelsRateLimiter } from "../../middlewares/rateLimit.middleware.js";
import { searchHotels } from "./hotels.controller.js";

const router = Router();

// Authenticated, unlike weather: every cache miss spends one search against a
// free-tier SerpApi plan, so this is not a surface to leave open to anonymous
// traffic. Rate limited on top of that for the same reason.
router.get("/", authMiddleware, hotelsRateLimiter, searchHotels);

export default router;
