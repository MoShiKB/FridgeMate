import { z } from "zod";

const DietPreferenceEnum = z.enum(["NONE", "VEGETARIAN", "VEGAN", "PESCATARIAN"]);

export const GenerateRecipesSchema = z.object({
  ingredients: z.array(z.string().min(1)).min(1, "At least one ingredient is required").max(50),
  allergies: z.array(z.string()).optional().default([]),
  dietPreference: DietPreferenceEnum.optional().default("NONE"),
  count: z.number().int().min(1).max(10).optional().default(3),
});

export const AskAISchema = z.object({
  query: z.string().min(1),
  recipe: z
    .object({
      title: z.string(),
      ingredients: z.array(z.any()).optional(),
      steps: z.array(z.string()).optional(),
    })
    .optional(),
  recipeId: z.string().optional(),
  ingredients: z.array(z.string()).optional().default([]),
});
