import { z } from 'zod';
import { CONTENT_STATUS } from '../../config/constants.js';

export const createCreatorContentSchema = z.object({
  product_id: z.string().uuid('Escolha um produto válido.').optional(),
  content_kit_id: z.string().uuid('Escolha um roteiro válido.').optional(),
  content_kit_briefing: z.string().trim().max(1500, 'Descreva o vídeo em até 1500 caracteres.').optional(),
}).strict().refine((data) => Boolean(data.product_id || data.content_kit_id), {
  message: 'Escolha um produto ou um roteiro.',
});

export const selectContentKitSchema = z.object({
  content_kit_id: z.string().uuid('Escolha um roteiro válido.'),
}).strict();

export const updateCreatorContentSchema = z.object({
  status: z.enum([
    CONTENT_STATUS.SALVO,
    CONTENT_STATUS.EM_PRODUCAO,
    CONTENT_STATUS.GRAVADO,
    CONTENT_STATUS.PUBLICADO,
  ]).optional(),
  notas: z.string().max(2000).optional(),
  published_url: z.string().url('Esse link não é válido.').refine((value) => {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com');
    } catch {
      return false;
    }
  }, 'Informe um link válido do TikTok.').optional().nullable(),
  scheduled_for: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida no formato AAAA-MM-DD.')
    .refine((value) => {
      const date = new Date(`${value}T12:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, 'Informe uma data existente.')
    .optional()
    .nullable(),
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: 'Escolha o que você quer atualizar.',
});

export type CreateCreatorContentInput = z.infer<typeof createCreatorContentSchema>;
export type SelectContentKitInput = z.infer<typeof selectContentKitSchema>;
export type UpdateCreatorContentInput = z.infer<typeof updateCreatorContentSchema>;
