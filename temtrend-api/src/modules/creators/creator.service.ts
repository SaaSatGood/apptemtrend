import { findCreatorByUserId, createCreator, updateCreator } from './creator.repository.js';
import type { OnboardingInput } from './creator.schema.js';

export async function getMe(userId: string) {
  const creator = await findCreatorByUserId(userId);

  const onboardingCompleto = !!creator && (
    creator.onboarding_completo === true ||
    creator.nicho?.length > 0 ||
    creator.plataformas?.length > 0
  );

  return {
    user_id: userId,
    creator: creator || null,
    onboarding_completo: onboardingCompleto,
  };
}

export async function onboarding(userId: string, data: OnboardingInput) {
  const existing = await findCreatorByUserId(userId);

  const creator = existing
    ? await updateCreator(existing.id, {
      objetivo: data.objetivo,
      estilos_conteudo: data.estilos_conteudo,
      temas_interesse: data.temas_interesse,
      nicho: data.temas_interesse,
      plataformas: ['tiktok'],
      onboarding_completo: true,
    })
    : await createCreator({
      user_id: userId,
      objetivo: data.objetivo,
      estilos_conteudo: data.estilos_conteudo,
      temas_interesse: data.temas_interesse,
      nicho: data.temas_interesse,
      plataformas: ['tiktok'],
      onboarding_completo: true,
    });

  return creator;
}
