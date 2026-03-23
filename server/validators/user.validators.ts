import { z } from "zod";

const DietPreferenceEnum = z.enum(["NONE", "VEGETARIAN", "VEGAN", "PESCATARIAN"]);

const AddressSchema = z.object({
  country: z.string().optional(),
  city: z.string().optional(),
  fullAddress: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const UserIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const UpdateProfileSchema = z.object({
  userName: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_.-]+$/, "userName may only contain letters, digits, underscores, dots, or hyphens")
    .optional(),
  displayName: z.string().min(1).max(50).optional(),
  profileImage: z.string().optional(),
  address: AddressSchema.optional(),
  allergies: z.array(z.string()).optional(),
  dietPreference: DietPreferenceEnum.optional(),
});

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});
