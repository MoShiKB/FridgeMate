import { z } from "zod";

export const CreateFridgeSchema = z.object({
  name: z.string().min(1),
});

export const JoinFridgeSchema = z.object({
  inviteCode: z.string().min(1),
});
