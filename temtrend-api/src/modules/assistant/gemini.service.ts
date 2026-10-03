import { z } from 'zod';
import { env } from '../../config/env.js';
import { AI_LIMITS } from '../../config/constants.js';
import { logger } from '../../lib/logger.js';
import type { Product } from '../../types/index.js';

const geminiDecisionSchema = z.object({
  in_scope: z.boolean(),
  intent_summary: z.string().max(160),
  search_terms: z.array(z.string().max(50)).max(12),
  selected_product_ids: z.array(z.string()).max(6),
}).strict();

const geminiResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({
      parts: z.array(z.object({ text: z.string() }).passthrough()),
    }).passthrough(),
  }).passthrough()).min(1),
  usageMetadata: z.object({
    promptTokenCount: z.number().optional(),
    candidatesTokenCount: z.number().optional(),
    thoughtsTokenCount: z.number().optional(),
    totalTokenCount: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();

export type AssistantUsage = {
  prompt_tokens: number;
  response_tokens: number;
  thoughts_tokens: number;
  total_tokens: number;
};

export type GeminiCatalogDecision = z.infer<typeof geminiDecisionSchema> & {
  provider: 'gemini';
  usage: AssistantUsage;
  latency_ms: number;
};

export function parseAndConstrainDecision(text: string, allowedIds: Set<string>) {
  const decision = geminiDecisionSchema.parse(JSON.parse(text));
  return {
    ...decision,
    selected_product_ids: decision.in_scope
      ? decision.selected_product_ids.filter((id) => allowedIds.has(id)).slice(0, 6)
      : [],
  };
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    in_scope: { type: 'BOOLEAN' },
    intent_summary: { type: 'STRING' },
    search_terms: { type: 'ARRAY', items: { type: 'STRING' } },
    selected_product_ids: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['in_scope', 'intent_summary', 'search_terms', 'selected_product_ids'],
  propertyOrdering: ['in_scope', 'intent_summary', 'search_terms', 'selected_product_ids'],
} as const;

function usageFromResponse(response: z.infer<typeof geminiResponseSchema>): AssistantUsage {
  const usage = response.usageMetadata;
  return {
    prompt_tokens: usage?.promptTokenCount ?? 0,
    response_tokens: usage?.candidatesTokenCount ?? 0,
    thoughts_tokens: usage?.thoughtsTokenCount ?? 0,
    total_tokens: usage?.totalTokenCount ?? 0,
  };
}

const MAX_CATALOG_ITEMS = AI_LIMITS.MAX_CATALOG_ITEMS;
const MAX_DESCRIPTION_CHARS = AI_LIMITS.MAX_DESCRIPTION_CHARS;

export async function classifyCatalogRequest(
  message: string,
  products: Product[],
): Promise<GeminiCatalogDecision | null> {
  if (!env.GEMINI_API_KEY || env.NODE_ENV === 'test') return null;

  const allowedIds = new Set(products.map((product) => product.id));
  const catalog = products.slice(0, MAX_CATALOG_ITEMS).map((product) => ({
    id: product.id,
    nome: product.nome,
    categoria: product.categoria,
    descricao: (product.descricao || '').slice(0, MAX_DESCRIPTION_CHARS),
    loja: product.loja_nome,
    preco: product.preco_texto,
    preco_min_brl: product.preco_min_brl,
    preco_max_brl: product.preco_max_brl,
    comissao_percentual: product.comissao_percentual,
    unidades_vendidas_periodo: product.unidades_vendidas_periodo,
    crescimento_vendas_percentual: product.crescimento_vendas_percentual,
  }));
  const startedAt = Date.now();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: [
                'Você é o assistente inteligente da TemTrend.',
                'Seu papel é encontrar produtos reais já cadastrados no catálogo da plataforma para que o creator grave conteúdo.',
                'Nunca crie, invente, proponha ou persista um produto novo. Somente administradores cadastram produtos.',
                'Analise nome, categoria, descrição, finalidade, público e forma de uso de todos os itens do catálogo.',
                'Selecione apenas IDs recebidos no catálogo. Se não houver opção adequada, mantenha selected_product_ids vazio e sugira outra busca.',
                'Retorne in_scope=false apenas para assuntos totalmente fora do contexto de e-commerce, vendas ou produção de conteúdo.',
                'Não inclua explicações fora do JSON solicitado.',
              ].join(' '),
            }],
          },
          contents: [{
            role: 'user',
            parts: [{ text: JSON.stringify({ mensagem: message, catalogo: catalog }) }],
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 256,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(AI_LIMITS.CLASSIFY_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const payload = geminiResponseSchema.parse(await response.json());
    const text = payload.candidates[0]?.content.parts.map((part) => part.text).join('') ?? '';
    const decision = parseAndConstrainDecision(text, allowedIds);
    const latencyMs = Date.now() - startedAt;
    const usage = usageFromResponse(payload);

    logger.info({
      provider: 'gemini',
      model: env.GEMINI_MODEL,
      in_scope: decision.in_scope,
      selected_products: decision.selected_product_ids.length,
      usage,
      latency_ms: latencyMs,
    }, 'Assistant classification completed');

    return {
      ...decision,
      provider: 'gemini',
      usage,
      latency_ms: latencyMs,
    };
  } catch (error) {
    logger.warn({
      err: error,
      provider: 'gemini',
      model: env.GEMINI_MODEL,
      latency_ms: Date.now() - startedAt,
    }, 'Assistant classification failed; using local fallback');
    return null;
  }
}
