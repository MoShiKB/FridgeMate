import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { ScanController } from "../controllers/scan.controller";
import { ScanIdParamsSchema } from "../validators/scan.validators";
import { uploadScanImage } from "../middlewares/upload";

export const scanRoutes = Router();

scanRoutes.post("/", requireAuth, uploadScanImage, asyncHandler(ScanController.upload));
scanRoutes.get("/:scanId", requireAuth, validate({ params: ScanIdParamsSchema }), asyncHandler(ScanController.getById));
