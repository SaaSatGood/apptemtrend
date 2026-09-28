import { findCreatorByUserId, createCreator, updateCreator } from './creator.repository.js';
import { isAdminUser } from '../../plugins/auth.js';
import type { OnboardingInput } from './creator.schema.js';

export async function getMe(userId: string) {
  const [creator, is_admin] = await Promise.all([
    findCreatorByUserId(userId),
    isAdminUser(userId),
  ]);

  const onboardingCompleto = !!creator && (
    creator.onboarding_completo === true ||
    (creator.nicho?.length ?? 0) > 0 ||
    (creator.plataformas?.length ?? 0) > 0
  );

  return {
    user_id: userId,
    creator: creator || null,
    onboarding_completo: onboardingCompleto,
    is_admin,
  };
}

export async function onboarding(userId: string, data: OnboardingInput) {
  const preferences = {
    objetivo: data.objetivo,
    estilos_conteudo: data.estilos_conteudo,
    temas_interesse: data.temas_interesse,
    onboarding_completo: true,
  };

  const existing = await findCreatorByUserId(userId);

  return existing
    ? await updateCreator(existing.id, preferences)
    : await createCreator({ user_id: userId, ...preferences });
}
