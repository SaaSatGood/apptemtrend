import { z } from 'zod';

export const assistantProductSearchSchema = z.object({
  message: z.string().trim().min(3, 'Conte o que você quer vender.').max(500),
  product_ids: z.array(z.string().uuid()).max(50).optional(),
}).strict();

export type AssistantProductSearchInput = z.infer<typeof assistantProductSearchSchema>;
