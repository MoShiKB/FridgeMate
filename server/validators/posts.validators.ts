import { z } from "zod";

export const PostsQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  // Optional future: bounding box / near query
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().optional(),
});

export const CreatePostSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  mediaUrls: z.array(z.string().url()).optional().default([]),
  recipeId: z.string().optional(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
      placeName: z.string().optional(),
    })
    .optional(),
});

export const UpdatePostSchema = z.object({
  title: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
      placeName: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export const PostIdParamsSchema = z.object({
  post_id: z.string().min(1),
});
