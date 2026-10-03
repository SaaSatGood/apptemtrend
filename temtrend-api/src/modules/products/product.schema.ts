import { z } from 'zod';

export const createProductSchema = z.object({
  produto_externo_id: z.string().trim().min(1).max(80).optional(),
  nome: z.string().min(1, 'Nome é obrigatório.').max(500),
  descricao: z.string().max(4000).optional(),
  categoria: z.string().max(200).optional(),
  imagem_url: z.string().url('Informe um link de imagem válido.'),
  loja_nome: z.string().trim().max(200).optional(),
  preco_texto: z.string().trim().max(100).optional(),
  preco_min_brl: z.number().min(0).optional(),
  preco_max_brl: z.number().min(0).optional(),
  pais_regiao: z.string().trim().max(20).optional(),
  comissao_percentual: z.number().min(0).max(100).optional(),
  unidades_vendidas_periodo: z.number().int().min(0).optional(),
  crescimento_vendas_percentual: z.number().optional(),
  unidades_vendidas_total: z.number().int().min(0).optional(),
  receita_periodo_brl: z.number().min(0).optional(),
  receita_total_brl: z.number().min(0).optional(),
  data_estimada_upload: z.string().trim().max(50).optional(),
  unidades_vendidas_total_loja: z.number().int().min(0).optional(),
  fastmoss_produto_url: z.string().url().optional(),
  tiktok_shop_url: z.string().url().optional(),
  fastmoss_loja_url: z.string().url().optional(),
  status_origem: z.string().trim().max(50).optional(),
  fonte_dados: z.string().trim().max(255).optional(),
  ranking_origem: z.number().int().min(1).optional(),
  status: z.enum(['ativo', 'pausado']).default('ativo'),
  destaque: z.boolean().default(false),
  ordem_destaque: z.number().int().min(0).default(0),
}).strict();

export const updateProductSchema = createProductSchema.partial().strict();

export const productQuerySchema = z.object({
  categoria: z.string().optional(),
  destaque: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
