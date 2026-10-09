import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import type { ContentKit, Product } from '../../types/index.js';
import { classifyCatalogRequest, type GeminiCatalogDecision } from './gemini.service.js';
import {
  generateContentKit,
  type GeneratedContentKit,
} from './gemini-generation.service.js';

export type IntentDecision = GeminiCatalogDecision;

/**
 * Camada única de IA da TemTrend.
 * A aplicação conversa apenas com esta camada; trocar o provedor/modelo
 * significa trocar a implementação interna, não o resto da aplicação.
 */
export const AIService = {
  isAvailable(): boolean {
    return Boolean(env.GEMINI_API_KEY) && env.NODE_ENV !== 'test';
  },

  /** Interpreta a intenção de uma mensagem usando apenas o catálogo informado. */
  async interpretIntent(message: string, catalog: Product[]): Promise<IntentDecision | null> {
    return classifyCatalogRequest(message, catalog);
  },

  /** Refina a intenção já limitada ao conjunto de produtos em disputa. */
  async refineProductSearch(message: string, candidates: Product[]): Promise<IntentDecision | null> {
    return classifyCatalogRequest(message, candidates);
  },

  /** Monta um Content Kit usando somente informações reais do produto. */
  async generateContentKit(product: Product, previousKits: Partial<ContentKit>[] = [], creatorBriefing?: string): Promise<GeneratedContentKit | null> {
    const result = await generateContentKit(product, previousKits, creatorBriefing);
    if (!result) {
      logger.warn({ product_id: product.id }, 'AIService could not generate a content kit');
    }
    return result;
  },
};
