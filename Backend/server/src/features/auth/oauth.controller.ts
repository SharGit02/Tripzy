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
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
    const frontendUrl = getFrontendUrl(req);
    const { code, error } = req.query;

    if (error || !code) {
        const errorMsg = String(error || "Google authorization was not completed.");
        res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`);
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
        if (!googleUser?.email) {
            throw new Error("Unable to retrieve email from Google profile.");
        }

        const email = String(googleUser.email).toLowerCase();
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
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

export async function githubCallback(req: Request, res: Response): Promise<void> {
    const frontendUrl = getFrontendUrl(req);
    const { code, error } = req.query;

    if (error || !code) {
        const errorMsg = String(error || "GitHub authorization was not completed.");
        res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`);
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
        let email = ghUser.email;

        // If public email is not set on GitHub, fetch verified email list
        if (!email) {
            const emailsRes = await fetch("https://api.github.com/user/emails", {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                    "User-Agent": "Tripzy-Travel-App",
                },
            });
            const emails = await emailsRes.json();
            if (Array.isArray(emails)) {
                const primary = emails.find((e: any) => e.primary && e.verified) || emails.find((e: any) => e.verified) || emails[0];
                if (primary?.email) {
                    email = primary.email;
                }
            }
        }

        if (!email) {
            throw new Error("Unable to retrieve a verified email address from your GitHub account.");
        }

        email = String(email).toLowerCase();
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
