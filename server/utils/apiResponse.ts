import { Response } from "express";

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function items<T>(
  res: Response,
  payload: { items: T[]; total: number; page: number; limit: number },
  status = 200
) {
  return res.status(status).json(payload);
}
