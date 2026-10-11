import { describe, expect, it } from 'vitest';
import { AI_LIMITS, RATE_LIMITS } from '../src/config/constants.js';
import { AI_QUOTA, checkAssistantQuota, checkForceNewCooldown, checkKitQuota, getAiMetrics } from '../src/lib/ai-metrics.js';
import { CONTENT_STRATEGY_INSTRUCTIONS } from '../src/modules/assistant/gemini-generation.service.js';

describe('AI token cost', () => {
  it('usa catálogo enxuto na classificação', () => {
    expect(AI_LIMITS.MAX_CATALOG_ITEMS).toBeLessThanOrEqual(25);
    expect(AI_LIMITS.MAX_DESCRIPTION_CHARS).toBeLessThanOrEqual(60);
    // 400 cobre a decisão base (~100) + motivos curtos de até 5 produtos
    expect(AI_LIMITS.CLASSIFY_MAX_OUTPUT_TOKENS).toBeLessThanOrEqual(400);
  });

  it('limita geração e reaproveitamento', () => {
    expect(AI_LIMITS.MAX_GENERATION_ATTEMPTS).toBe(3);
    expect(AI_LIMITS.GENERATE_MAX_OUTPUT_TOKENS).toBeLessThanOrEqual(3000);
    expect(AI_LIMITS.MAX_PREVIOUS_KITS).toBeLessThanOrEqual(3);
    expect(AI_LIMITS.MAX_BRIEFING_CHARS).toBeLessThanOrEqual(400);
    expect(AI_LIMITS.MAX_PRODUCT_DESC_CHARS).toBeLessThanOrEqual(500);
  });

  it('mantém guardrails mesmo com prompt curto', () => {
    expect(CONTENT_STRATEGY_INSTRUCTIONS).toMatch(/Sem evidência recente suficiente/);
    expect(CONTENT_STRATEGY_INSTRUCTIONS).toMatch(/EXPERIMENTAL/);
    expect(CONTENT_STRATEGY_INSTRUCTIONS).toMatch(/3 VARIAÇÕES DE HOOK/);
    expect(CONTENT_STRATEGY_INSTRUCTIONS).toMatch(/VERSÃO SEM SEGUIDORES/);
    expect(CONTENT_STRATEGY_INSTRUCTIONS).toMatch(/só JSON/);
    // Prompt comprimido: antes ~1900 chars, agora bem menor
    expect(CONTENT_STRATEGY_INSTRUCTIONS.length).toBeLessThan(1600);
  });

  it('rate-limit de IA protege custo', () => {
    expect(RATE_LIMITS.ASSISTANT_SEARCH.max).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS.CONTENT_KIT_GENERATE.max).toBeLessThanOrEqual(5);
  });

  it('cota diária e cooldown existem', () => {
    expect(AI_QUOTA.ASSISTANT_PER_DAY).toBe(100);
    expect(AI_QUOTA.KIT_PER_DAY).toBe(30);
    expect(checkAssistantQuota('test-user')).toBe(true);
    expect(checkKitQuota('test-user')).toBe(true);
    expect(checkForceNewCooldown('c1', 'p1')).toBe(true);
    const metrics = getAiMetrics();
    expect(metrics).toHaveProperty('classifyCalls');
    expect(metrics).toHaveProperty('generateCalls');
  });
});
