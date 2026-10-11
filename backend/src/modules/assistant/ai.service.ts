import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import type { ContentKit, Product } from '../../types/index.js';
import { classifyCatalogRequest as geminiClassify, type GeminiCatalogDecision } from './gemini.service.js';
import {
  generateContentKit as geminiGenerate,
  type GeneratedContentKit,
} from './gemini-generation.service.js';
import { classifyCatalogRequest as orClassifyCatalogRequest } from './openrouter.service.js';
import { generateContentKit as orGenerateContentKit } from './openrouter.service.js';

export type IntentDecision = GeminiCatalogDecision;

/**
 * Camada única de IA da TemTrend.
 * Provedor selecionado por AI_PROVIDER (gemini|openrouter); com o primário
 * fora, tenta o secundário quando configurado antes de desistir.
 * A aplicação conversa apenas com esta camada; trocar o provedor/modelo
 * significa trocar a implementação interna, não o resto da aplicação.
 */
type Provider = 'gemini' | 'openrouter';

function primaryProvider(): Provider {
  return env.AI_PROVIDER === 'openrouter' ? 'openrouter' : 'gemini';
}

function providerConfigured(provider: Provider): boolean {
  if (env.NODE_ENV === 'test') return false;
  return provider === 'openrouter'
    ? Boolean(env.OPENROUTER_API_KEY)
    : Boolean(env.GEMINI_API_KEY);
}

export function aiStatus(): { provider: Provider; model: string; configured: boolean } {
  const provider = primaryProvider();
  return {
    provider,
    model: provider === 'openrouter' ? env.OPENROUTER_MODEL : env.GEMINI_MODEL,
    configured: providerConfigured(provider),
  };
}

export const AIService = {
  isAvailable(): boolean {
    return providerConfigured('gemini') || providerConfigured('openrouter');
  },

  /** Interpreta a intenção de uma mensagem usando apenas o catálogo informado. */
  async interpretIntent(message: string, catalog: Product[]): Promise<IntentDecision | null> {
    const primary = primaryProvider();
    const secondary: Provider = primary === 'openrouter' ? 'gemini' : 'openrouter';
    if (providerConfigured(primary)) {
      const result = primary === 'openrouter'
        ? await orClassifyCatalogRequest(message, catalog)
        : await geminiClassify(message, catalog);
      if (result) return result;
      logger.warn({ primary }, 'Primary AI provider failed on classify; trying secondary');
    }
    if (providerConfigured(secondary)) {
      return secondary === 'openrouter'
        ? orClassifyCatalogRequest(message, catalog)
        : geminiClassify(message, catalog);
    }
    return null;
  },

  /** Refina a intenção já limitada ao conjunto de produtos em disputa. */
  async refineProductSearch(message: string, candidates: Product[]): Promise<IntentDecision | null> {
    // Mesma chamada do classify, com catálogo reduzido.
    return this.interpretIntent(message, candidates);
  },

  /** Monta um Content Kit usando somente informações reais do produto. */
  async generateContentKit(product: Product, previousKits: Partial<ContentKit>[] = [], creatorBriefing?: string, creatorVoice?: string | null): Promise<GeneratedContentKit | null> {
    const primary = primaryProvider();
    const secondary: Provider = primary === 'openrouter' ? 'gemini' : 'openrouter';
    if (providerConfigured(primary)) {
      const result = primary === 'openrouter'
        ? await orGenerateContentKit(product, previousKits, creatorBriefing, creatorVoice)
        : await geminiGenerate(product, previousKits, creatorBriefing, creatorVoice);
      if (result) return result;
      logger.warn({ primary, product_id: product.id }, 'Primary AI provider failed on generate; trying secondary');
    }
    if (providerConfigured(secondary)) {
      return secondary === 'openrouter'
        ? await orGenerateContentKit(product, previousKits, creatorBriefing, creatorVoice)
        : await geminiGenerate(product, previousKits, creatorBriefing, creatorVoice);
    }
    logger.warn({ product_id: product.id }, 'AIService could not generate a content kit');
    return null;
  },
};
