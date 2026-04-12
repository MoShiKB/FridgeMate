import { z } from "zod";

export const RecipeIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const RecipePaginationQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});
