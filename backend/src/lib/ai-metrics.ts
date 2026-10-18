type DayCounters = {
  day: string;
  assistantCalls: number;
  kitCalls: number;
  promptChars: number;
  totalTokens: number;
};

const globalTotals = {
  classifyCalls: 0,
  classifyTokens: 0,
  classifyPromptChars: 0,
  classifyCacheHits: 0,
  generateCalls: 0,
  generateTokens: 0,
  generatePromptChars: 0,
  generateRetries: 0,
};

// Cota diária por usuário para conter custo em abuso (MVP, single-process).
const perUser = new Map<string, DayCounters>();

export const AI_QUOTA = {
  ASSISTANT_PER_DAY: 100,
  KIT_PER_DAY: 30,
  FORCE_NEW_COOLDOWN_MS: 30 * 1000,
} as const;

type QuotaKind = 'assistant' | 'kit';

function usesDatabaseStore() {
  return env.AI_QUOTA_STORE === 'database' && env.NODE_ENV !== 'test';
}

async function reserveDatabaseQuota(userId: string, kind: QuotaKind, limit: number) {
  const { data, error } = await supabaseAdmin.rpc('reserve_ai_quota', {
    p_user_id: userId,
    p_kind: kind,
    p_daily_limit: limit,
  });
  if (error) {
    logger.error({ err: error, kind }, 'Persistent AI quota reservation failed');
    throw new Error('Persistent AI quota unavailable');
  }
  return data === true;
}

export async function reserveAssistantQuota(
  userId: string,
  dailyLimit: number = AI_QUOTA.ASSISTANT_PER_DAY,
): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') return true;
  if (usesDatabaseStore()) {
    return reserveDatabaseQuota(userId, 'assistant', dailyLimit);
  }
  if (!checkAssistantQuota(userId, dailyLimit)) return false;
  incrementAssistantQuota(userId);
  return true;
}

export async function reserveKitQuota(
  userId: string,
  dailyLimit: number = AI_QUOTA.KIT_PER_DAY,
): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') return true;
  if (usesDatabaseStore()) {
    return reserveDatabaseQuota(userId, 'kit', dailyLimit);
  }
  if (!checkKitQuota(userId, dailyLimit)) return false;
  incrementKitQuota(userId);
  return true;
}

export async function releaseQuota(userId: string, kind: QuotaKind): Promise<void> {
  if (!usesDatabaseStore()) {
    const counters = userCounters(userId);
    if (kind === 'assistant') counters.assistantCalls = Math.max(0, counters.assistantCalls - 1);
    else counters.kitCalls = Math.max(0, counters.kitCalls - 1);
    return;
  }
  const { error } = await supabaseAdmin.rpc('release_ai_quota', {
    p_user_id: userId,
    p_kind: kind,
  });
  if (error) logger.error({ err: error, kind }, 'Persistent AI quota release failed');
}

export async function reserveForceNew(
  creatorId: string,
  productId: string,
  cooldownMs: number = AI_QUOTA.FORCE_NEW_COOLDOWN_MS,
): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') return true;
  if (!usesDatabaseStore()) {
    if (!checkForceNewCooldown(creatorId, productId, cooldownMs)) return false;
    markForceNew(creatorId, productId);
    return true;
  }
  const { data, error } = await supabaseAdmin.rpc('reserve_force_new', {
    p_creator_id: creatorId,
    p_product_id: productId,
    p_cooldown_seconds: Math.ceil(cooldownMs / 1000),
  });
  if (error) {
    logger.error({ err: error }, 'Persistent force-new cooldown reservation failed');
    throw new Error('Persistent AI cooldown unavailable');
  }
  return data === true;
}

export async function releaseForceNew(creatorId: string, productId: string): Promise<void> {
  if (!usesDatabaseStore()) {
    forceNewCooldown.delete(`${creatorId}:${productId}`);
    return;
  }
  const { error } = await supabaseAdmin.rpc('release_force_new', {
    p_creator_id: creatorId,
    p_product_id: productId,
  });
  if (error) logger.error({ err: error }, 'Persistent force-new cooldown release failed');
}

const forceNewCooldown = new Map<string, number>();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function userCounters(userId: string): DayCounters {
  const day = todayKey();
  const existing = perUser.get(userId);
  if (existing && existing.day === day) return existing;
  const fresh: DayCounters = { day, assistantCalls: 0, kitCalls: 0, promptChars: 0, totalTokens: 0 };
  perUser.set(userId, fresh);
  if (perUser.size > 5000) {
    const oldest = perUser.keys().next().value;
    if (oldest) perUser.delete(oldest);
  }
  return fresh;
}

export function checkAssistantQuota(userId: string, dailyLimit: number = AI_QUOTA.ASSISTANT_PER_DAY): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  return userCounters(userId).assistantCalls < dailyLimit;
}

export function checkKitQuota(userId: string, dailyLimit: number = AI_QUOTA.KIT_PER_DAY): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  return userCounters(userId).kitCalls < dailyLimit;
}

export function checkForceNewCooldown(
  creatorId: string,
  productId: string,
  cooldownMs: number = AI_QUOTA.FORCE_NEW_COOLDOWN_MS,
): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const key = `${creatorId}:${productId}`;
  const last = forceNewCooldown.get(key);
  if (!last) return true;
  return Date.now() - last > cooldownMs;
}

export function markForceNew(creatorId: string, productId: string) {
  forceNewCooldown.set(`${creatorId}:${productId}`, Date.now());
}

export function incrementAssistantQuota(userId: string) {
  if (process.env.NODE_ENV === 'test') return;
  userCounters(userId).assistantCalls += 1;
}

export function incrementKitQuota(userId: string) {
  if (process.env.NODE_ENV === 'test') return;
  userCounters(userId).kitCalls += 1;
}

export function recordAssistantCall(userId: string | undefined, promptChars: number, totalTokens: number, cached: boolean) {
  globalTotals.classifyCalls += 1;
  globalTotals.classifyPromptChars += promptChars;
  globalTotals.classifyTokens += totalTokens;
  if (cached) globalTotals.classifyCacheHits += 1;
  if (userId && process.env.NODE_ENV !== 'test') {
    const c = userCounters(userId);
    c.assistantCalls += 1;
    c.promptChars += promptChars;
    c.totalTokens += totalTokens;
  }
  if (usesDatabaseStore()) {
    void supabaseAdmin.rpc('record_ai_metrics', {
      p_kind: 'classify', p_tokens: totalTokens, p_prompt_chars: promptChars, p_retries: 0, p_cached: cached,
    }).then(({ error }) => {
      if (error) logger.error({ err: error }, 'Persistent assistant metrics write failed');
    });
  }
}

export function recordGenerateCall(promptChars: number, totalTokens: number, retries: number, userId?: string) {
  globalTotals.generateCalls += 1;
  globalTotals.generatePromptChars += promptChars;
  globalTotals.generateTokens += totalTokens;
  globalTotals.generateRetries += retries;
  if (userId && process.env.NODE_ENV !== 'test') {
    const c = userCounters(userId);
    c.kitCalls += 1;
    c.promptChars += promptChars;
    c.totalTokens += totalTokens;
  }
  if (usesDatabaseStore()) {
    void supabaseAdmin.rpc('record_ai_metrics', {
      p_kind: 'generate', p_tokens: totalTokens, p_prompt_chars: promptChars, p_retries: retries, p_cached: false,
    }).then(({ error }) => {
      if (error) logger.error({ err: error }, 'Persistent generation metrics write failed');
    });
  }
}

export function getAiMetrics() {
  return {
    ...globalTotals,
    quota: AI_QUOTA,
    tracked_users: perUser.size,
  };
}

export async function getAiMetricsSnapshot() {
  if (!usesDatabaseStore()) return { ...getAiMetrics(), store: 'memory' as const };
  const { data, error } = await supabaseAdmin
    .from('ai_metrics_daily')
    .select('*')
    .eq('usage_date', new Date().toISOString().slice(0, 10))
    .maybeSingle();
  if (error) {
    logger.error({ err: error }, 'Persistent AI metrics read failed');
    return { ...getAiMetrics(), store: 'memory-fallback' as const };
  }
  return { ...(data ?? {}), quota: AI_QUOTA, store: 'database' as const };
}
import { env } from '../config/env.js';
import { supabaseAdmin } from './supabase.js';
import { logger } from './logger.js';

