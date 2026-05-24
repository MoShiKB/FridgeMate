import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { JournalController } from "../controllers/journal.controller";
import {
  CreateJournalEntrySchema,
  JournalIdParamsSchema,
  JournalQuerySchema,
  UpdateJournalEntrySchema,
} from "../validators/journal.validators";

export const journalRoutes = Router();

journalRoutes.post(
  "/",
  requireAuth,
  validate({ body: CreateJournalEntrySchema }),
  asyncHandler(JournalController.create)
);

journalRoutes.get(
  "/",
  requireAuth,
  validate({ query: JournalQuerySchema }),
  asyncHandler(JournalController.list)
);

journalRoutes.get(
  "/:id",
  requireAuth,
  validate({ params: JournalIdParamsSchema }),
  asyncHandler(JournalController.getById)
);

journalRoutes.put(
  "/:id",
  requireAuth,
  validate({ params: JournalIdParamsSchema, body: UpdateJournalEntrySchema }),
  asyncHandler(JournalController.update)
);

journalRoutes.delete(
  "/:id",
  requireAuth,
  validate({ params: JournalIdParamsSchema }),
  asyncHandler(JournalController.remove)
);

export default journalRoutes;
