import { z } from 'zod';

export const VOZ_EXEMPLO_MAX = 500;

const vozExemploSchema = z.string().trim().max(VOZ_EXEMPLO_MAX).optional().default('');

export const onboardingSchema = z.object({
  objetivo: z.enum(['comecar_vender', 'vender_mais', 'criar_videos', 'explorando']),
  estilos_conteudo: z.array(z.string().trim().min(1).max(60)).max(7).default([]),
  temas_interesse: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  voz_exemplo: vozExemploSchema,
}).strict();

export type OnboardingInput = z.infer<typeof onboardingSchema>;
