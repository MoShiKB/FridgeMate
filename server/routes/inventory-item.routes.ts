import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { InventoryItemController } from "../controllers/inventory-item.controller";
import {
  CreateInventoryItemSchema,
  UpdateInventoryItemSchema,
  InventoryItemIdParamsSchema,
  InventoryItemQuerySchema,
} from "../validators/inventory-item.validators";
import { z } from "zod";

// Params schema for fridgeId
const FridgeIdParamsSchema = z.object({
  fridgeId: z.string().min(1),
});

// Combined params schema for routes with both fridgeId and itemId
const ItemParamsSchema = FridgeIdParamsSchema.merge(InventoryItemIdParamsSchema);

export const inventoryItemRoutes = Router({ mergeParams: true });

// All routes require authentication
inventoryItemRoutes.use(requireAuth);

// Create item: POST /fridges/:fridgeId/items
inventoryItemRoutes.post(
  "/",
  validate({ params: FridgeIdParamsSchema, body: CreateInventoryItemSchema.omit({ fridgeId: true }) }),
  asyncHandler(InventoryItemController.create)
);

// Get all items: GET /fridges/:fridgeId/items
inventoryItemRoutes.get(
  "/",
  validate({ params: FridgeIdParamsSchema, query: InventoryItemQuerySchema }),
  asyncHandler(InventoryItemController.getAll)
);

// Get single item: GET /fridges/:fridgeId/items/:itemId
inventoryItemRoutes.get(
  "/:itemId",
  validate({ params: ItemParamsSchema }),
  asyncHandler(InventoryItemController.getById)
);

// Update item: PATCH /fridges/:fridgeId/items/:itemId
inventoryItemRoutes.patch(
  "/:itemId",
  validate({ params: ItemParamsSchema, body: UpdateInventoryItemSchema }),
  asyncHandler(InventoryItemController.update)
);

// Delete item: DELETE /fridges/:fridgeId/items/:itemId
inventoryItemRoutes.delete(
  "/:itemId",
  validate({ params: ItemParamsSchema }),
  asyncHandler(InventoryItemController.delete)
);
