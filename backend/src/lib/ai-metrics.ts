type DayCounters = {
  day: string;
  assistantCalls: number;
  kitCalls: number;
  supportCalls: number;
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
  // Uso justo do Pro (não é cota vendida): alto o bastante para não aparecer.
  ASSISTANT_PER_DAY: 1_000,
  KIT_PER_DAY: 30,
  SUPPORT_PER_DAY: 40,
  FORCE_NEW_COOLDOWN_MS: 30 * 1000,
} as const;

/**
 * Fuso das cotas: o dia vira à meia-noite de Brasília, não em UTC, para o
 * usuário brasileiro não perder o limite às 21h.
 */
const QUOTA_TIME_ZONE = 'America/Sao_Paulo';

/** Data local (YYYY-MM-DD) usada como chave da cota diária. */
export function quotaDayKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: QUOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Segunda-feira da semana local (YYYY-MM-DD), usada como chave da cota semanal. */
export function quotaWeekStartKey(date: Date = new Date()): string {
  const day = new Date(`${quotaDayKey(date)}T00:00:00.000Z`);
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
}

/** Início da semana local em ISO (segunda 00:00 de Brasília = 03:00Z). */
export function quotaWeekStartIso(date: Date = new Date()): string {
  return `${quotaWeekStartKey(date)}T03:00:00.000Z`;
}

/** Próximo reset da cota (meia-noite ou próxima segunda), em ISO. */
export function quotaResetIso(period: 'day' | 'week', date: Date = new Date()): string {
  const base = period === 'day' ? quotaDayKey(date) : quotaWeekStartKey(date);
  const next = new Date(`${base}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + (period === 'day' ? 1 : 7));
  return `${next.toISOString().slice(0, 10)}T03:00:00.000Z`;
}

type QuotaKind = 'assistant' | 'kit' | 'support';

function usesDatabaseStore() {
  return env.AI_QUOTA_STORE === 'database' && env.NODE_ENV !== 'test';
}

async function reserveDatabaseQuota(
  userId: string,
  kind: QuotaKind,
  limit: number,
  usageDate: string = quotaDayKey(),
) {
  const { data, error } = await supabaseAdmin.rpc('reserve_ai_quota_on', {
    p_user_id: userId,
    p_kind: kind,
    p_daily_limit: limit,
    p_usage_date: usageDate,
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

/**
 * Uso atual do plano Grátis na janela semanal (renova toda segunda):
 * buscas e roteiros são somados de segunda até hoje.
 */
export async function getFreeUsage(
  userId: string,
  _creatorId?: string,
): Promise<{ searchesWeek: number; kitsWeek: number }> {
  // Testes unitários não têm banco: sem uso registrado, as regras de cota
  // continuam sendo exercitadas sem rede.
  if (process.env.NODE_ENV === 'test') return { searchesWeek: 0, kitsWeek: 0 };
  const day = quotaDayKey();
  const weekStart = quotaWeekStartKey();
  const { data, error } = await supabaseAdmin
    .from('ai_usage_daily')
    .select('assistant_calls, kit_calls')
    .eq('user_id', userId)
    .gte('usage_date', weekStart)
    .lte('usage_date', day);
  if (error) {
    logger.error({ err: error }, 'Failed to read free usage window');
    throw new Error('Free usage unavailable');
  }
  let searchesWeek = 0;
  let kitsWeek = 0;
  for (const row of data ?? []) {
    const dayRow = row as { assistant_calls?: number; kit_calls?: number };
    searchesWeek += dayRow.assistant_calls ?? 0;
    kitsWeek += dayRow.kit_calls ?? 0;
  }
  return { searchesWeek, kitsWeek };
}

async function reserveFreeWeeklyQuota(
  userId: string,
  kind: 'assistant' | 'kit',
  weeklyLimit: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('reserve_free_quota_week', {
    p_user_id: userId,
    p_kind: kind,
    p_limit: weeklyLimit,
    p_week_start: quotaWeekStartKey(),
    p_usage_date: quotaDayKey(),
  });
  if (error) {
    logger.error({ err: error, kind }, 'Persistent free weekly quota reservation failed');
    throw new Error('Free weekly quota unavailable');
  }
  return data === true;
}

/** Busca grátis: cota semanal; volta toda segunda-feira. */
export async function reserveFreeAssistantQuota(userId: string, weeklyLimit: number): Promise<boolean> {
  return reserveFreeWeeklyQuota(userId, 'assistant', weeklyLimit);
}

/** Roteiro grátis: cota semanal; volta toda segunda-feira. */
export async function reserveFreeKitQuota(
  userId: string,
  _creatorId: string,
  weeklyLimit: number,
): Promise<boolean> {
  return reserveFreeWeeklyQuota(userId, 'kit', weeklyLimit);
}

export async function releaseFreeQuota(userId: string, kind: QuotaKind): Promise<void> {
  const { error } = await supabaseAdmin.rpc('release_ai_quota_on', {
    p_user_id: userId,
    p_kind: kind,
    p_usage_date: quotaDayKey(),
  });
  if (error) logger.error({ err: error, kind }, 'Failed to release free quota');
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

/** Cota própria do assistente de suporte: não consome buscas nem kits. */
export async function reserveSupportQuota(
  userId: string,
  dailyLimit: number = AI_QUOTA.SUPPORT_PER_DAY,
): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') return true;
  if (usesDatabaseStore()) {
    return reserveDatabaseQuota(userId, 'support', dailyLimit);
  }
  if (!checkSupportQuota(userId, dailyLimit)) return false;
  userCounters(userId).supportCalls += 1;
  return true;
}

export async function releaseSupportQuota(userId: string): Promise<void> {
  await releaseQuota(userId, 'support');
}

export async function releaseQuota(userId: string, kind: QuotaKind): Promise<void> {
  if (!usesDatabaseStore()) {
    const counters = userCounters(userId);
    if (kind === 'assistant') counters.assistantCalls = Math.max(0, counters.assistantCalls - 1);
    else if (kind === 'kit') counters.kitCalls = Math.max(0, counters.kitCalls - 1);
    else counters.supportCalls = Math.max(0, counters.supportCalls - 1);
    return;
  }
  const { error } = await supabaseAdmin.rpc('release_ai_quota_on', {
    p_user_id: userId,
    p_kind: kind,
    p_usage_date: quotaDayKey(),
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

function userCounters(userId: string): DayCounters {
  const day = quotaDayKey();
  const existing = perUser.get(userId);
  if (existing && existing.day === day) return existing;
  const fresh: DayCounters = { day, assistantCalls: 0, kitCalls: 0, supportCalls: 0, promptChars: 0, totalTokens: 0 };
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

export function checkSupportQuota(userId: string, dailyLimit: number = AI_QUOTA.SUPPORT_PER_DAY): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  return userCounters(userId).supportCalls < dailyLimit;
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
  const memory = getAiMetrics();
  if (!usesDatabaseStore()) return { ...memory, store: 'memory' as const };
  const { data, error } = await supabaseAdmin
    .from('ai_metrics_daily')
    .select('*')
    .eq('usage_date', new Date().toISOString().slice(0, 10))
    .maybeSingle();
  if (error) {
    logger.error({ err: error }, 'Persistent AI metrics read failed');
    return { ...memory, store: 'memory-fallback' as const };
  }
  // O processo atual sempre sabe o que chamou desde o boot: os contadores em
  // memória preenchem o dia mesmo quando o banco ainda não tem a linha.
  return {
    ...memory,
    ...(data ?? {}),
    quota: AI_QUOTA,
    store: 'database' as const,
  };
}
import { env } from '../config/env.js';
import { supabaseAdmin } from './supabase.js';
import { logger } from './logger.js';

