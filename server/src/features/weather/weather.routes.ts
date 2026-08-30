import { Router } from "express";
import { weatherRateLimiter } from "../../middlewares/rateLimit.middleware.js";
import { getWeather } from "./weather.controller.js";

const router = Router();

// Public: the catalog/landing surfaces show weather before sign-in. It is rate
// limited because every miss costs a call against our OpenWeather quota.
router.get("/", weatherRateLimiter, getWeather);

export default router;
