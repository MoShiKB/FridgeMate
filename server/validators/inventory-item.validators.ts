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

// Assign a new owner to an item, or pass null to unassign (any fridge member can reassign)
export const AssignOwnerSchema = z.object({
  ownerId: z.string().min(1).nullable(),
});

// Route params schema
export const InventoryItemIdParamsSchema = z.object({
  itemId: z.string().min(1),
});

// Not z.coerce.boolean(): that is Boolean(input), which turns the string "false" into true.
const BooleanQueryParam = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true")
  .optional();

// Query schema for filtering
export const InventoryItemQuerySchema = z.object({
  fridgeId: z.string().min(1).optional(),
  ownership: ItemOwnershipEnum.optional(),
  // When true, only items owned by the requesting user or unowned are returned
  // (used e.g. by recipe generation, which shouldn't suggest other members' items)
  mineOrUnowned: BooleanQueryParam,
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

// Types inferred from schemas
export type CreateInventoryItemInput = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof UpdateInventoryItemSchema>;
export type InventoryItemQuery = z.infer<typeof InventoryItemQuerySchema>;
export type AssignOwnerInput = z.infer<typeof AssignOwnerSchema>;
