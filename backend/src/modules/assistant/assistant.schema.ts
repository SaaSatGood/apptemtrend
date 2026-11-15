import { z } from 'zod';

export const assistantProductSearchSchema = z.object({
  message: z.string().trim().min(3, 'Digite pelo menos 3 caracteres.').max(500),
  product_ids: z.array(z.string().uuid()).max(50).optional(),
  image: z.object({
    mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    data: z.string().min(16).max(900_000).regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Imagem inválida.'),
  }).strict().superRefine((image, context) => {
    const bytes = Buffer.from(image.data, 'base64');
    const validSignature = image.mime_type === 'image/jpeg'
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : image.mime_type === 'image/png'
        ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!validSignature) context.addIssue({ code: 'custom', message: 'Envie uma imagem real JPEG, PNG ou WEBP.' });
  }).optional(),
}).strict();

export type AssistantProductSearchInput = z.infer<typeof assistantProductSearchSchema>;

/** Um turno da conversa do Descobrir (pergunta + resposta + produtos exibidos). */
const discoverySessionTurnSchema = z.object({
  query: z.string().max(500).default(''),
  message: z.string().max(8000).default(''),
  products: z.array(z.looseObject({ id: z.string() })).max(10).default([]),
  needs_clarification: z.boolean().optional(),
  image_name: z.string().max(300).nullable().optional(),
}).loose();

export const discoverySessionCreateSchema = z.object({
  title: z.string().max(120).optional(),
  context: z.enum(['discover', 'create', 'surprise', 'week']).optional(),
  turns: z.array(discoverySessionTurnSchema).max(12).optional(),
}).strict();

export const discoverySessionUpdateSchema = discoverySessionCreateSchema.partial();
