import { z } from 'zod';

export const createProductSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório.').max(200),
  descricao: z.string().max(2000).optional(),
  categoria: z.string().max(100).optional(),
  imagem_url: z.string().url(),
  status: z.enum(['ativo', 'pausado']).default('ativo'),
  destaque: z.boolean().default(false),
  ordem_destaque: z.number().int().min(0).default(0),
}).strict();

export const updateProductSchema = createProductSchema.partial().strict();

export const productQuerySchema = z.object({
  categoria: z.string().optional(),
  destaque: z.enum(['true', 'false']).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
