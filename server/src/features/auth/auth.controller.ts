import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { userRepository } from "../users/user.repository.js";
import { authService } from "../../services/auth.service.js";
import type { UserRow } from "../../db/schema.js";
import { signupSchema, loginSchema } from "./auth.schema.js";

function toPublicUser(user: Pick<UserRow, "id" | "name" | "email" | "role">) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };
}

function cookieOptions(maxAge: number) {
    return {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
        maxAge,
        path: "/",
    };
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie("refreshToken", refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
}

function clearAuthCookies(res: Response): void {
    const clearOptions = {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
        path: "/",
    };

    res.clearCookie("accessToken", clearOptions);
    res.clearCookie("refreshToken", clearOptions);
}

export async function signup(req: Request, res: Response): Promise<void> {
    try {
        console.log("[SIGNUP] Request body:", req.body);
        const parsed = signupSchema.safeParse(req.body);
        if (!parsed.success) {
            console.log("[SIGNUP] Validation error:", parsed.error.flatten().fieldErrors);
            res.status(400).json({ message: "Invalid signup data.", errors: parsed.error.flatten().fieldErrors });
            return;
        }

        const { name, email, password } = parsed.data;
        console.log("[SIGNUP] Parsed data:", { name, email, password: "***" });

        const passwordCheck = authService.validatePassword(password);
        if (!passwordCheck.valid) {
            console.log("[SIGNUP] Password validation failed:", passwordCheck.message);
            res.status(400).json({ message: passwordCheck.message });
            return;
        }

        console.log("[SIGNUP] Checking existing user...");
        const existingUser = await userRepository.findByEmail(email);
        console.log("[SIGNUP] Existing user check done:", existingUser ? "found" : "not found");
        if (existingUser) {
            console.log("[SIGNUP] User already exists:", email);
            res.status(409).json({ message: "An account with that email already exists." });
            return;
        }

        console.log("[SIGNUP] Hashing password...");
        const hashedPassword = await authService.hashPassword(password);
        console.log("[SIGNUP] Password hashed");
        const user = await userRepository.create({
            name,
            email,
            password: hashedPassword,
        });
        console.log("[SIGNUP] User created:", user.id);

        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };

        const accessToken = authService.generateAccessToken(payload);
        const refreshToken = authService.generateRefreshToken(payload);
        setAuthCookies(res, accessToken, refreshToken);

        res.status(201).json({
            message: "Account created successfully.",
            user: toPublicUser(user),
        });
    } catch (error) {
        console.error("[SIGNUP] Error:", error);
        res.status(500).json({ message: "Unable to create account.", error: error instanceof Error ? error.message : "Unknown error" });
    }
}

export async function login(req: Request, res: Response): Promise<void> {
    try {
        console.log("[LOGIN] Request body:", req.body);
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            console.log("[LOGIN] Validation error:", parsed.error.flatten().fieldErrors);
            res.status(400).json({ message: "Invalid login data.", errors: parsed.error.flatten().fieldErrors });
            return;
        }

        const { email, password } = parsed.data;
        console.log("[LOGIN] Parsed data:", { email, password: "***" });

        const user = await userRepository.findByEmail(email);
        if (!user) {
            console.log("[LOGIN] User not found:", email);
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }

        const passwordMatches = await authService.comparePasswords(password, user.password);
        if (!passwordMatches) {
            console.log("[LOGIN] Password mismatch for:", email);
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }

        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };

        const accessToken = authService.generateAccessToken(payload);
        const refreshToken = authService.generateRefreshToken(payload);
        setAuthCookies(res, accessToken, refreshToken);

        res.status(200).json({
            message: "Signed in successfully.",
            user: toPublicUser(user),
        });
    } catch (error) {
        console.error("[LOGIN] Error:", error);
        res.status(500).json({ message: "Unable to sign in.", error: error instanceof Error ? error.message : "Unknown error" });
    }
}

export async function logout(_req: Request, res: Response): Promise<void> {
    clearAuthCookies(res);
    res.status(200).json({ message: "Signed out successfully." });
}

export async function refresh(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.refreshToken;
    if (!token) {
        res.status(401).json({ message: "Refresh token is required." });
        return;
    }

    let payload;
    try {
        payload = authService.verifyToken(token);
    } catch {
        clearAuthCookies(res);
        res.status(401).json({ message: "Invalid or expired refresh token." });
        return;
    }

    if (payload.type !== "refresh") {
        clearAuthCookies(res);
        res.status(401).json({ message: "Invalid refresh token." });
        return;
    }

    const user = await userRepository.findById(payload.userId);
    if (!user) {
        clearAuthCookies(res);
        res.status(401).json({ message: "Invalid refresh token." });
        return;
    }

    const newPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
    };

    const accessToken = authService.generateAccessToken(newPayload);
    const refreshToken = authService.generateRefreshToken(newPayload);
    setAuthCookies(res, accessToken, refreshToken);

    res.status(200).json({ user: toPublicUser(user) });
}

export async function me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
        res.status(401).json({ message: "Authentication required." });
        return;
    }

    const user = await userRepository.findById(req.user.userId);
    if (!user) {
        res.status(404).json({ message: "User not found." });
        return;
    }

    res.status(200).json({ user: toPublicUser(user) });
}