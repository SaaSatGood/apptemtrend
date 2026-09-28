import { z } from 'zod';

export const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(20),
  scopes: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const postIdSchema = z.object({ id: z.string().uuid() });

export const creatorContentFieldSchema = z.string().uuid('Conteúdo inválido.');

export const publishSchema = z.object({
  caption: z.string().max(2200, 'A legenda deve ter no máximo 2200 caracteres.').optional(),
  privacyLevel: z.string().min(1),
  disableComment: z.boolean().default(false),
  disableDuet: z.boolean().default(false),
  disableStitch: z.boolean().default(false),
  coverTimestampMs: z.number().int().min(0).default(1000),
}).strict();

export type PublishInput = z.infer<typeof publishSchema>;

