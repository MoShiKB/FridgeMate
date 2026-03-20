import { z } from "zod";

export const ScanIdParamsSchema = z.object({
  scanId: z.string().min(1),
});

export type ScanIdParams = z.infer<typeof ScanIdParamsSchema>;
