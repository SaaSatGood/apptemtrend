import { z } from 'zod';

export const onboardingSchema = z.object({
  objetivo: z.enum(['comecar_vender', 'vender_mais', 'criar_videos', 'explorando']),
  estilos_conteudo: z.array(z.string().trim().min(1).max(60)).max(7).default([]),
  temas_interesse: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
}).strict();

export type OnboardingInput = z.infer<typeof onboardingSchema>;
