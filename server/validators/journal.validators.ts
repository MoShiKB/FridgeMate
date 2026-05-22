import { z } from "zod";

export const JournalQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const JournalMealSchema = z.object({
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
  recipeId: z.string().optional().nullable(),
  customRecipeTitle: z.string().trim().optional().nullable(),
  calories: z.number().nonnegative().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const CreateJournalEntrySchema = z.object({
  title: z.string().min(1, "Title is required").trim(),
  content: z.string().trim().optional(),
  date: z.string().optional(), // standard ISO string or date
  meals: z.array(JournalMealSchema).optional().default([]),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  mood: z.string().trim().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
});

export const UpdateJournalEntrySchema = z.object({
  title: z.string().min(1).trim().optional(),
  content: z.string().trim().optional(),
  date: z.string().optional(),
  meals: z.array(JournalMealSchema).optional(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  mood: z.string().trim().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
});

export const JournalIdParamsSchema = z.object({
  id: z.string().min(1),
});
