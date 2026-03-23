import { z } from "zod";

// Ownership enum values
export const ItemOwnershipEnum = z.enum(["SHARED", "PRIVATE"]);

// Create inventory item schema
export const CreateInventoryItemSchema = z.object({
  fridgeId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.string().min(1),
  ownership: ItemOwnershipEnum.default("PRIVATE"),
});

// Update inventory item schema (all fields optional)
export const UpdateInventoryItemSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.string().min(1).optional(),
  ownership: ItemOwnershipEnum.optional(),
});

// Route params schema
export const InventoryItemIdParamsSchema = z.object({
  itemId: z.string().min(1),
});

// Query schema for filtering
export const InventoryItemQuerySchema = z.object({
  fridgeId: z.string().min(1).optional(),
  ownership: ItemOwnershipEnum.optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

// Types inferred from schemas
export type CreateInventoryItemInput = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof UpdateInventoryItemSchema>;
export type InventoryItemQuery = z.infer<typeof InventoryItemQuerySchema>;
