import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

type AuthedRequest = Request & { user?: { userId: string } };

function unauthorized(res: Response) {
  return res.status(401).json({ message: "Unauthorized" });
}


export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return unauthorized(res);
  }

  const token = authHeader.slice("bearer ".length).trim();
  if (!token) return unauthorized(res);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId?: string };

    if (!payload.userId) return unauthorized(res);

    (req as AuthedRequest).user = { userId: payload.userId };
    return next();
  } catch {
    return unauthorized(res);
  }
}
