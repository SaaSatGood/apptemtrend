import { z } from 'zod';

export const createContentKitSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório.').max(200),
  descricao: z.string().max(2000).optional(),
  formato: z.string().max(100).optional(),
  plataforma: z.string().max(100).optional(),
  nivel_dificuldade: z.string().max(50).optional(),
  hook: z.string().max(500).optional(),
  roteiro: z.string().max(5000).optional(),
  cenas: z.any().optional(),
  copy: z.string().max(2000).optional(),
  cta: z.string().max(500).optional(),
  hashtags: z.array(z.string()).optional(),
  audio_sugerido: z.string().max(200).optional(),
  duracao_seg: z.number().int().positive().optional(),
}).strict();

export const updateContentKitSchema = createContentKitSchema.partial().strict();

export type CreateContentKitInput = z.infer<typeof createContentKitSchema>;
export type UpdateContentKitInput = z.infer<typeof updateContentKitSchema>;
