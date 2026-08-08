import { z } from "zod";

export const ScanIdParamsSchema = z.object({
  scanId: z.string().min(1),
});

export const ScanQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

export type ScanIdParams = z.infer<typeof ScanIdParamsSchema>;
export type ScanQuery = z.infer<typeof ScanQuerySchema>;
