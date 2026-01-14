import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "../utils/errors";

/**
 * Temporary auth middleware until Firebase integration.
 * Modes:
 * - DEV_AUTH_MODE=header: expects `x-user-id`
 * - DEV_AUTH_MODE=jwt: expects `Authorization: Bearer <jwt>` with payload { userId }
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const mode = env.DEV_AUTH_MODE;

  if (mode === "header") {
    const userId = req.header("x-user-id")?.trim();
    if (!userId) return next(new ApiError(401, "Unauthorized", "UNAUTHORIZED"));
    req.user = { userId };
    return next();
  }

  const header = req.header("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return next(new ApiError(401, "Unauthorized", "UNAUTHORIZED"));
  }
  const token = header.slice("bearer ".length).trim();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId?: string };
    if (!payload.userId) throw new Error("missing userId");
    req.user = { userId: payload.userId };
    return next();
  } catch {
    return next(new ApiError(401, "Unauthorized", "UNAUTHORIZED"));
  }
}
