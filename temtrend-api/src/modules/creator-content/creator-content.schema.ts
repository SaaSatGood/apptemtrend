import { z } from 'zod';
import { CONTENT_STATUS } from '../../config/constants.js';

export const createCreatorContentSchema = z.object({
  product_id: z.string().uuid('product_id deve ser um UUID válido.').optional(),
  content_kit_id: z.string().uuid('content_kit_id deve ser um UUID válido.').optional(),
}).strict().refine((data) => Boolean(data.product_id) !== Boolean(data.content_kit_id), {
  message: 'Informe um produto ou um Content Kit.',
});

export const updateCreatorContentSchema = z.object({
  status: z.enum([
    CONTENT_STATUS.SALVO,
    CONTENT_STATUS.EM_PRODUCAO,
    CONTENT_STATUS.GRAVADO,
    CONTENT_STATUS.PUBLICADO,
  ]),
  notas: z.string().max(2000).optional(),
  published_url: z.string().url('URL de publicação inválida.').optional().nullable(),
}).strict();

export type CreateCreatorContentInput = z.infer<typeof createCreatorContentSchema>;
export type UpdateCreatorContentInput = z.infer<typeof updateCreatorContentSchema>;
