import { z } from 'zod';

const baseProductFields = {
  produto_externo_id: z.string().trim().min(1).max(80).optional(),
  nome: z.string().trim().min(1, 'Nome é obrigatório.').max(500),
  descricao: z.string().trim().max(4000).optional(),
  categoria: z.string().trim().max(200).optional(),
  imagem_url: z.string().trim().url('Informe um link de imagem válido.'),
  loja_nome: z.string().trim().max(200).optional(),
  preco_texto: z.string().trim().max(100).optional(),
  preco_min_brl: z.number().finite().min(0).optional(),
  preco_max_brl: z.number().finite().min(0).optional(),
  pais_regiao: z.string().trim().max(20).optional(),
  comissao_percentual: z.number().finite().min(0).max(100).optional(),
  unidades_vendidas_periodo: z.number().int().min(0).optional(),
  crescimento_vendas_percentual: z.number().finite().optional(),
  unidades_vendidas_total: z.number().int().min(0).optional(),
  receita_periodo_brl: z.number().finite().min(0).optional(),
  receita_total_brl: z.number().finite().min(0).optional(),
  data_estimada_upload: z.string().trim().max(50).optional().refine(
    (v) => !v || !Number.isNaN(Date.parse(v)),
    'Data estimada inválida.',
  ),
  unidades_vendidas_total_loja: z.number().int().min(0).optional(),
  fastmoss_produto_url: z.string().trim().url().optional(),
  tiktok_shop_url: z.string().trim().url().optional(),
  fastmoss_loja_url: z.string().trim().url().optional(),
  status_origem: z.string().trim().max(50).optional(),
  fonte_dados: z.string().trim().max(255).optional(),
  ranking_origem: z.number().int().min(1).optional(),
  status: z.enum(['ativo', 'pausado']).default('ativo'),
  destaque: z.boolean().default(false),
  ordem_destaque: z.number().int().min(0).default(0),
};

function priceRangeOk(d: { preco_min_brl?: number; preco_max_brl?: number }) {
  return d.preco_min_brl === undefined || d.preco_max_brl === undefined || d.preco_min_brl <= d.preco_max_brl;
}

export const createProductSchema = z.object(baseProductFields).strict().refine(priceRangeOk, {
  message: 'Preço mínimo não pode ser maior que o máximo.',
  path: ['preco_max_brl'],
});

export const updateProductSchema = z.object({
  produto_externo_id: baseProductFields.produto_externo_id,
  nome: z.string().trim().min(1).max(500).optional(),
  descricao: baseProductFields.descricao,
  categoria: baseProductFields.categoria,
  imagem_url: z.string().trim().url().optional(),
  loja_nome: baseProductFields.loja_nome,
  preco_texto: baseProductFields.preco_texto,
  preco_min_brl: baseProductFields.preco_min_brl,
  preco_max_brl: baseProductFields.preco_max_brl,
  pais_regiao: baseProductFields.pais_regiao,
  comissao_percentual: baseProductFields.comissao_percentual,
  unidades_vendidas_periodo: baseProductFields.unidades_vendidas_periodo,
  crescimento_vendas_percentual: baseProductFields.crescimento_vendas_percentual,
  unidades_vendidas_total: baseProductFields.unidades_vendidas_total,
  receita_periodo_brl: baseProductFields.receita_periodo_brl,
  receita_total_brl: baseProductFields.receita_total_brl,
  data_estimada_upload: baseProductFields.data_estimada_upload,
  unidades_vendidas_total_loja: baseProductFields.unidades_vendidas_total_loja,
  fastmoss_produto_url: baseProductFields.fastmoss_produto_url,
  tiktok_shop_url: baseProductFields.tiktok_shop_url,
  fastmoss_loja_url: baseProductFields.fastmoss_loja_url,
  status_origem: baseProductFields.status_origem,
  fonte_dados: baseProductFields.fonte_dados,
  ranking_origem: baseProductFields.ranking_origem,
  status: z.enum(['ativo', 'pausado']).optional(),
  destaque: z.boolean().optional(),
  ordem_destaque: z.number().int().min(0).optional(),
}).strict().refine(priceRangeOk, {
  message: 'Preço mínimo não pode ser maior que o máximo.',
  path: ['preco_max_brl'],
});

export const productQuerySchema = z.object({
  categoria: z.string().optional(),
  destaque: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
