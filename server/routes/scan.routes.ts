import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { ScanController } from "../controllers/scan.controller";
import { ScanIdParamsSchema, ScanQuerySchema } from "../validators/scan.validators";
import { uploadScanImage } from "../middlewares/upload";

export const scanRoutes = Router();

scanRoutes.post("/", requireAuth, uploadScanImage, asyncHandler(ScanController.upload));
scanRoutes.get("/", requireAuth, validate({ query: ScanQuerySchema }), asyncHandler(ScanController.getAll));
scanRoutes.get("/:scanId", requireAuth, validate({ params: ScanIdParamsSchema }), asyncHandler(ScanController.getById));
