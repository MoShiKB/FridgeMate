import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

type ValidateParts = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

export function validate(parts: ValidateParts) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (parts.body) {
        req.body = parts.body.parse(req.body) as any;
      }

      if (parts.query) {
        req.query = parts.query.parse(req.query) as any;
      }

      if (parts.params) {
        req.params = parts.params.parse(req.params) as any;
      }

      return next();
    } catch (err: any) {
      return res.status(400).json({
        message: "Validation error",
        errors: err?.errors ?? err?.issues ?? err,
      });
    }
  };
}
