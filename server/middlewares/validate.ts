import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

type Parts = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

export function validate(parts: Parts) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (parts.body) req.body = parts.body.parse(req.body);
      if (parts.query) req.query = parts.query.parse(req.query);
      if (parts.params) req.params = parts.params.parse(req.params);
      next();
    } catch (err) {
      next(err);
    }
  };
}
