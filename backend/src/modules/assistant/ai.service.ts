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
import {
  classifyCatalogRequest as ocClassifyCatalogRequest,
  generateContentKit as ocGenerateContentKit,
} from './opencode.service.js';
import { describeVisualReference, type VisualReference } from './visual-context.service.js';

export type IntentDecision = GeminiCatalogDecision;

/**
 * Camada única de IA da TemTrend.
 * Provedor selecionado por AI_PROVIDER (gemini|openrouter|opencode); com o
 * primário fora, tenta os demais na ordem de fallback antes de desistir.
 * A aplicação conversa apenas com esta camada; trocar o provedor/modelo
 * significa trocar a implementação interna, não o resto da aplicação.
 */
type Provider = 'gemini' | 'openrouter' | 'opencode';

const FALLBACK_ORDER: Record<Provider, Provider[]> = {
  gemini: ['gemini', 'opencode', 'openrouter'],
  openrouter: ['openrouter', 'opencode', 'gemini'],
  opencode: ['opencode', 'gemini', 'openrouter'],
};

function primaryProvider(): Provider {
  return env.AI_PROVIDER;
}

function providerModel(provider: Provider): string {
  if (provider === 'openrouter') return env.OPENROUTER_MODEL;
  if (provider === 'opencode') return env.OPENCODE_MODEL;
  return env.GEMINI_MODEL;
}

function providerConfigured(provider: Provider): boolean {
  if (env.NODE_ENV === 'test') return false;
  if (provider === 'openrouter') return Boolean(env.OPENROUTER_API_KEY);
  if (provider === 'opencode') return Boolean(env.OPENCODE_API_KEY);
  return Boolean(env.GEMINI_API_KEY);
}

/** Provedores na ordem de tentativa, ignorando os que não têm credencial. */
function providerChain(): Provider[] {
  return FALLBACK_ORDER[primaryProvider()].filter(providerConfigured);
}

function classifyWith(provider: Provider, message: string, catalog: Product[], userId?: string) {
  if (provider === 'openrouter') return orClassifyCatalogRequest(message, catalog, userId);
  if (provider === 'opencode') return ocClassifyCatalogRequest(message, catalog, userId);
  return geminiClassify(message, catalog, userId);
}

function generateWith(provider: Provider, product: Product, previousKits: Partial<ContentKit>[], creatorBriefing?: string, creatorVoice?: string | null, userId?: string) {
  if (provider === 'openrouter') return orGenerateContentKit(product, previousKits, creatorBriefing, creatorVoice, userId);
  if (provider === 'opencode') return ocGenerateContentKit(product, previousKits, creatorBriefing, creatorVoice, userId);
  return geminiGenerate(product, previousKits, creatorBriefing, creatorVoice, userId);
}

export function aiStatus(): { provider: Provider; model: string; configured: boolean } {
  const provider = primaryProvider();
  return {
    provider,
    model: providerModel(provider),
    configured: providerChain().length > 0,
  };
}

export const AIService = {
  isAvailable(): boolean {
    return providerChain().length > 0;
  },

  /** Interpreta a intenção de uma mensagem usando apenas o catálogo informado. */
  async interpretIntent(message: string, catalog: Product[], userId?: string): Promise<IntentDecision | null> {
    for (const provider of providerChain()) {
      const result = await classifyWith(provider, message, catalog, userId);
      if (result) return result;
      logger.warn({ provider }, 'AI provider failed on classify; trying next');
    }
    return null;
  },

  /** Refina a intenção já limitada ao conjunto de produtos em disputa. */
  async refineProductSearch(message: string, candidates: Product[], userId?: string): Promise<IntentDecision | null> {
    // Mesma chamada do classify, com catálogo reduzido.
    return this.interpretIntent(message, candidates, userId);
  },

  /** Converte uma referência visual em contexto seguro para a busca do catálogo. */
  async describeVisualReference(image: VisualReference) {
    return describeVisualReference(image);
  },

  /** Monta um Content Kit usando somente informações reais do produto. */
  async generateContentKit(product: Product, previousKits: Partial<ContentKit>[] = [], creatorBriefing?: string, creatorVoice?: string | null, userId?: string): Promise<GeneratedContentKit | null> {
    for (const provider of providerChain()) {
      const result = await generateWith(provider, product, previousKits, creatorBriefing, creatorVoice, userId);
      if (result) return result;
      logger.warn({ provider, product_id: product.id }, 'AI provider failed on generate; trying next');
    }
    logger.warn({ product_id: product.id }, 'AIService could not generate a content kit');
    return null;
  },
};
