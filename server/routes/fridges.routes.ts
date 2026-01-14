import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { FridgesController } from "../controllers/fridges.controller";
import { CreateFridgeSchema, JoinFridgeSchema } from "../validators/fridges.validators";

export const fridgesRoutes = Router();

fridgesRoutes.post("/", requireAuth, validate({ body: CreateFridgeSchema }), asyncHandler(FridgesController.create));
fridgesRoutes.post("/join", requireAuth, validate({ body: JoinFridgeSchema }), asyncHandler(FridgesController.join));
fridgesRoutes.post("/leave", requireAuth, asyncHandler(FridgesController.leave));
fridgesRoutes.get("/me", requireAuth, asyncHandler(FridgesController.me));
fridgesRoutes.get("/me/members", requireAuth, asyncHandler(FridgesController.members));
