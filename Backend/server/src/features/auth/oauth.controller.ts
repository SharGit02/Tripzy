import crypto from "node:crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { userRepository } from "../users/user.repository.js";
import { authService } from "../../services/auth.service.js";
import { setAuthCookies } from "./auth.controller.js";

function getFrontendUrl(req: Request): string {
    if (env.FRONTEND_URL) return env.FRONTEND_URL.replace(/\/+$/, "");
    const httpsOrigin = env.CORS_ORIGIN_LIST.find((o) => o.startsWith("https://"));
    if (httpsOrigin) return httpsOrigin;
    if (env.CORS_ORIGIN_LIST.length > 0) return env.CORS_ORIGIN_LIST[0];
    return "https://mytripzy.vercel.app";
}

function getGoogleCallbackUrl(req: Request): string {
    if (env.GOOGLE_CALLBACK_URL) return env.GOOGLE_CALLBACK_URL;
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    return `${proto}://${req.get("host")}/api/auth/google/callback`;
}

function getGithubCallbackUrl(req: Request): string {
    if (env.GITHUB_CALLBACK_URL) return env.GITHUB_CALLBACK_URL;
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    return `${proto}://${req.get("host")}/api/auth/github/callback`;
}

/* ── OAuth state (CSRF protection for the authorization round-trip) ────────
 *
 * Without `state`, anyone can feed a victim a crafted /callback?code=... URL
 * and log that victim into the attacker's account (login CSRF), or have the
 * victim's browser complete a flow the victim never started.
 *
 * The nonce is kept in a short-lived httpOnly cookie and echoed through the
 * provider, so the callback can prove the flow began in this same browser.
 * A cookie rather than server state because the API runs on free-tier dynos
 * with no shared session store; the cookie IS the state, and it is compared
 * in constant time.
 */

const OAUTH_STATE_COOKIE = "oauthState";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function issueOAuthState(res: Response): string {
    const state = crypto.randomBytes(32).toString("hex");

    res.cookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        // The provider redirect is a top-level cross-site navigation, so the
        // cookie has to survive it: that needs SameSite=None, which browsers
        // only honour alongside Secure. On plain-http local dev, fall back to
        // Lax — a top-level GET redirect still carries a Lax cookie.
        secure: isSecureDeployment(),
        sameSite: isSecureDeployment() ? ("none" as const) : ("lax" as const),
        maxAge: OAUTH_STATE_TTL_MS,
        path: "/",
    });

    return state;
}

function consumeOAuthState(req: Request, res: Response): boolean {
    const expected = req.cookies?.[OAUTH_STATE_COOKIE];
    const received = req.query.state;

    // Single use: cleared whether or not it matched, so a leaked state cannot
    // be replayed.
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

    if (typeof expected !== "string" || typeof received !== "string") return false;
    if (expected.length !== received.length) return false;

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function isSecureDeployment(): boolean {
    return env.NODE_ENV === "production" || env.CORS_ORIGIN_LIST.some((o) => o.startsWith("https://"));
}

/**
 * Accepts an email address from an OAuth provider only when the provider says
 * it is verified.
 *
 * This is the account-takeover guard, not a nicety. A provider's profile email
 * is user-settable: on GitHub the public profile email is free text, and the
 * accounts here are matched by email (`findByEmail`). Trusting an unverified
 * address lets an attacker set their provider email to a victim's address and
 * sign straight into the victim's existing Tripzy account.
 */
function assertVerifiedEmail(email: unknown, verified: unknown, provider: string): string {
    if (verified !== true) {
        throw new Error(
            `Your ${provider} email address is not verified. Verify it with ${provider}, or sign in with an email and password.`,
        );
    }

    const value = String(email || "").trim().toLowerCase();
    if (!value || !value.includes("@")) {
        throw new Error(`Unable to retrieve a verified email address from your ${provider} account.`);
    }

    return value;
}

// ── Google OAuth ─────────────────────────────────────────────────────────────

export async function googleAuth(req: Request, res: Response): Promise<void> {
    const frontendUrl = getFrontendUrl(req);
    if (!env.GOOGLE_CLIENT_ID) {
        res.redirect(`${frontendUrl}/login?error=${encodeURIComponent("Google OAuth is not configured on the server.")}`);
        return;
    }

    const callbackUrl = getGoogleCallbackUrl(req);
    const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: callbackUrl,
        response_type: "code",
        scope: "openid profile email",
        access_type: "offline",
        prompt: "select_account",
        state: issueOAuthState(res),
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
    const frontendUrl = getFrontendUrl(req);
    const { code, error } = req.query;

    if (error || !code) {
        // The provider's own error string is reflected into a URL the browser
        // then loads, so a fixed message is used instead of echoing it back.
        res.redirect(
            `${frontendUrl}/login?error=${encodeURIComponent("Google authorization was not completed.")}`,
        );
        return;
    }

    if (!consumeOAuthState(req, res)) {
        res.redirect(
            `${frontendUrl}/login?error=${encodeURIComponent(
                "That sign-in link was invalid or expired. Please start again.",
            )}`,
        );
        return;
    }

    try {
        const callbackUrl = getGoogleCallbackUrl(req);
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code: String(code),
                client_id: env.GOOGLE_CLIENT_ID!,
                client_secret: env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: callbackUrl,
                grant_type: "authorization_code",
            }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
            throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange authorization code with Google.");
        }

        const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const googleUser = await userRes.json();

        // oauth2/v2/userinfo returns `verified_email`; the v3/openid shape
        // calls it `email_verified`. Accept either, require one.
        const email = assertVerifiedEmail(
            googleUser?.email,
            googleUser?.verified_email === true || googleUser?.email_verified === true,
            "Google",
        );
        const name = String(googleUser.name || email.split("@")[0]);
        const avatarUrl = googleUser.picture ? String(googleUser.picture) : undefined;

        let user = await userRepository.findByEmail(email);
        if (!user) {
            const randomPassword = crypto.randomUUID() + "!Aa1";
            const hashedPassword = await authService.hashPassword(randomPassword);
            user = await userRepository.create({
                name,
                email,
                password: hashedPassword,
            });
        }

        if (avatarUrl) {
            try {
                await userRepository.upsertProfile(user.id, { avatarUrl });
            } catch {
                // Non-fatal: continue login even if profile avatar update fails
            }
        }

        const tempToken = jwt.sign({ userId: user.id, type: "oauth_exchange" }, env.JWT_SECRET, { expiresIn: "1m" });
        res.redirect(`${frontendUrl}/dashboard?exchange_token=${tempToken}`);
    } catch (err) {
        console.error("[GOOGLE OAUTH ERROR]", err);
        const errorMsg = err instanceof Error ? err.message : "Failed to sign in with Google.";
        res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`);
    }
}

// ── GitHub OAuth ─────────────────────────────────────────────────────────────

export async function githubAuth(req: Request, res: Response): Promise<void> {
    const frontendUrl = getFrontendUrl(req);
    if (!env.GITHUB_CLIENT_ID) {
        res.redirect(`${frontendUrl}/login?error=${encodeURIComponent("GitHub OAuth is not configured on the server.")}`);
        return;
    }

    const callbackUrl = getGithubCallbackUrl(req);
    const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: callbackUrl,
        scope: "user:email",
        state: issueOAuthState(res),
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

export async function githubCallback(req: Request, res: Response): Promise<void> {
    const frontendUrl = getFrontendUrl(req);
    const { code, error } = req.query;

    if (error || !code) {
        res.redirect(
            `${frontendUrl}/login?error=${encodeURIComponent("GitHub authorization was not completed.")}`,
        );
        return;
    }

    if (!consumeOAuthState(req, res)) {
        res.redirect(
            `${frontendUrl}/login?error=${encodeURIComponent(
                "That sign-in link was invalid or expired. Please start again.",
            )}`,
        );
        return;
    }

    try {
        const callbackUrl = getGithubCallbackUrl(req);
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                client_id: env.GITHUB_CLIENT_ID,
                client_secret: env.GITHUB_CLIENT_SECRET,
                code: String(code),
                redirect_uri: callbackUrl,
            }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
            throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange authorization code with GitHub.");
        }

        const userRes = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                "User-Agent": "Tripzy-Travel-App",
            },
        });

        const ghUser = await userRes.json();

        /*
         * The verified-email list is the ONLY source, and `ghUser.email` (the
         * public profile field) is deliberately never consulted: it is free
         * text the account owner types, so it can be set to someone else's
         * address. Accounts here are matched by email, so trusting it was an
         * account-takeover path.
         */
        const emailsRes = await fetch("https://api.github.com/user/emails", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                "User-Agent": "Tripzy-Travel-App",
            },
        });

        const emails = await emailsRes.json();
        const verified = Array.isArray(emails)
            ? emails.find((e: any) => e?.primary && e?.verified) || emails.find((e: any) => e?.verified)
            : null;

        const email = assertVerifiedEmail(verified?.email, verified?.verified === true, "GitHub");
        const name = String(ghUser.name || ghUser.login || email.split("@")[0]);
        const avatarUrl = ghUser.avatar_url ? String(ghUser.avatar_url) : undefined;

        let user = await userRepository.findByEmail(email);
        if (!user) {
            const randomPassword = crypto.randomUUID() + "!Aa1";
            const hashedPassword = await authService.hashPassword(randomPassword);
            user = await userRepository.create({
                name,
                email,
                password: hashedPassword,
            });
        }

        if (avatarUrl) {
            try {
                await userRepository.upsertProfile(user.id, { avatarUrl });
            } catch {
                // Non-fatal
            }
        }

        const tempToken = jwt.sign({ userId: user.id, type: "oauth_exchange" }, env.JWT_SECRET, { expiresIn: "1m" });
        res.redirect(`${frontendUrl}/dashboard?exchange_token=${tempToken}`);
    } catch (err) {
        console.error("[GITHUB OAUTH ERROR]", err);
        const errorMsg = err instanceof Error ? err.message : "Failed to sign in with GitHub.";
        res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`);
    }
}

export async function oauthExchange(req: Request, res: Response): Promise<void> {
    const { token } = req.body;
    if (!token) {
        res.status(400).json({ message: "Exchange token required" });
        return;
    }
    try {
        const payload = jwt.verify(token, env.JWT_SECRET) as any;
        if (payload.type !== "oauth_exchange") {
            res.status(401).json({ message: "Invalid token type" });
            return;
        }

        const user = await userRepository.findById(payload.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const newPayload = { userId: user.id, email: user.email, role: user.role };
        const accessToken = authService.generateAccessToken(newPayload);
        const refreshToken = authService.generateRefreshToken(newPayload);
        setAuthCookies(res, accessToken, refreshToken);

        res.status(200).json({
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        res.status(401).json({ message: "Invalid or expired exchange token" });
    }
}
