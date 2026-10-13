import { findCreatorByUserId, createCreator, updateCreator } from './creator.repository.js';
import { isAdminUser } from '../../plugins/auth.js';
import { CACHE_TTL_MS } from '../../config/constants.js';
import { TtlCache } from '../../lib/cache.js';
import { Errors } from '../../types/index.js';
import { trackContatoCriadoOnce, trackOnboardingConcluido } from '../marketing/marketing.service.js';
import type { Creator } from '../../types/index.js';
import type { OnboardingInput } from './creator.schema.js';

const meCache = new TtlCache<{ user_id: string; creator: Creator | null; onboarding_completo: boolean; is_admin: boolean }>(500);

export function clearMeCacheForTests() {
  meCache.clear();
}

export function invalidateMeCache(userId: string) {
  meCache.delete(`me:${userId}`);
}

export async function getMe(userId: string, email?: string | null) {
  const cacheKey = `me:${userId}`;
  const cached = meCache.get(cacheKey);
  if (cached) return cached;

  const [creator, is_admin] = await Promise.all([
    findCreatorByUserId(userId),
    isAdminUser(userId),
  ]);

  if (!creator && email) {
    // Série de boas-vindas (uma vez por usuário). Fire-and-forget:
    // marketing nunca atrasa nem quebra o boot do app.
    void trackContatoCriadoOnce(userId, email);
  }

  const onboardingCompleto = !!creator && (
    creator.onboarding_completo === true ||
    (creator.nicho?.length ?? 0) > 0 ||
    (creator.plataformas?.length ?? 0) > 0
  );

  const result = {
    user_id: userId,
    creator: creator || null,
    onboarding_completo: onboardingCompleto,
    is_admin,
  };
  meCache.set(cacheKey, result, CACHE_TTL_MS.ME);
  return result;
}

export async function onboarding(userId: string, data: OnboardingInput, meta?: { email?: string | null }) {
  const voz = data.voz_exemplo?.trim() ? data.voz_exemplo.trim().slice(0, 500) : null;
  const preferences = {
    objetivo: data.objetivo,
    estilos_conteudo: data.estilos_conteudo,
    temas_interesse: data.temas_interesse,
    voz_exemplo: voz,
    onboarding_completo: true,
  };

  const existing = await findCreatorByUserId(userId);

  const creator = existing
    ? await updateCreator(existing.id, preferences)
    : await createCreator({ user_id: userId, ...preferences });

  invalidateMeCache(userId);

  if (meta?.email) {
    void trackOnboardingConcluido(meta.email, existing?.onboarding_completo === true);
  }

  return creator;
}

/**
 * Creator precisa existir e estar ativo para usar catálogo, IA e produção.
 * Bloqueado -> 403. Ausente -> 404 (mantém contrato atual).
 */
export async function requireActiveCreator(userId: string): Promise<Creator> {
  const creator = await findCreatorByUserId(userId);
  if (!creator) throw Errors.NOT_FOUND('Creator');
  if (creator.status === 'bloqueado') throw Errors.FORBIDDEN;
  return creator;
}
