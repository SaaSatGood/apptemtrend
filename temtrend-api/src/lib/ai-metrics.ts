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

export function checkAssistantQuota(userId: string): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  return userCounters(userId).assistantCalls < AI_QUOTA.ASSISTANT_PER_DAY;
}

export function checkKitQuota(userId: string): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  return userCounters(userId).kitCalls < AI_QUOTA.KIT_PER_DAY;
}

export function checkForceNewCooldown(creatorId: string, productId: string): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const key = `${creatorId}:${productId}`;
  const last = forceNewCooldown.get(key);
  if (!last) return true;
  return Date.now() - last > AI_QUOTA.FORCE_NEW_COOLDOWN_MS;
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
}

export function getAiMetrics() {
  return {
    ...globalTotals,
    quota: AI_QUOTA,
    tracked_users: perUser.size,
  };
}
