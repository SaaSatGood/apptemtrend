import { z } from 'zod';

/** Produto como apareceu no chat: retrato enxuto, sem dados internos do catalogo. */
export const sharedProductSchema = z.object({
  id: z.string().uuid(),
  produto_externo_id: z.string().max(80).nullish(),
  nome: z.string().trim().min(1, 'Produto sem nome.').max(240),
  descricao: z.string().max(600).nullish(),
  categoria: z.string().max(80).nullish(),
  imagem_url: z.string().max(600).nullish(),
  loja_nome: z.string().max(120).nullish(),
  preco_texto: z.string().max(60).nullish(),
  preco_min_brl: z.number().finite().nullish(),
  preco_max_brl: z.number().finite().nullish(),
  comissao_percentual: z.number().finite().nullish(),
  unidades_vendidas_periodo: z.number().finite().nullish(),
  unidades_vendidas_total: z.number().finite().nullish(),
  tiktok_shop_url: z.string().max(600).nullish(),
  motivo: z.string().max(300).nullish(),
});

export const sharedTurnSchema = z.object({
  query: z.string().trim().min(1, 'Escreva a pergunta deste turno.').max(500),
  message: z.string().trim().max(2000).default(''),
  products: z.array(sharedProductSchema).max(10).default([]),
  needs_clarification: z.boolean().default(false),
  image_name: z.string().max(200).nullish(),
});

export const createSharedConversationSchema = z.object({
  title: z.string().trim().max(120).optional(),
  turns: z.array(sharedTurnSchema).min(1, 'A conversa precisa de pelo menos uma mensagem.').max(12),
}).strict();

export const sharedImportSchema = z.object({
  product_id: z.string().uuid(),
  content_kit_id: z.string().uuid().optional(),
}).strict();

export const sharedSlugSchema = z.string().regex(/^[A-Za-z0-9_-]{8,32}$/, 'Link inválido.');

export type SharedTurnInput = z.infer<typeof sharedTurnSchema>;
export type CreateSharedConversationInput = z.infer<typeof createSharedConversationSchema>;
