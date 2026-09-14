import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { authRateLimiter, refreshRateLimiter } from "../../middlewares/rateLimit.middleware.js";
import { login, logout, me, refresh, signup } from "./auth.controller.js";
import { googleAuth, googleCallback, githubAuth, githubCallback } from "./oauth.controller.js";

const router = Router();

router.post("/signup", authRateLimiter, signup);
router.post("/login", authRateLimiter, login);
router.post("/logout", logout);
router.post("/refresh", refreshRateLimiter, refresh);
router.get("/me", authMiddleware, me);

// OAuth routes
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);
router.get("/github", githubAuth);
router.get("/github/callback", githubCallback);

export default router;