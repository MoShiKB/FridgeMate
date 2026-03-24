import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type AuthedRequest = Request & { user: { userId: string } };

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.slice("bearer ".length).trim();
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId?: string };
    if (!payload.userId) return res.status(401).json({ message: "Unauthorized" });

    (req as AuthedRequest).user = { userId: payload.userId };
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
