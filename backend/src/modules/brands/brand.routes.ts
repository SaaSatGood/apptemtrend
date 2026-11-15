import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { RATE_LIMITS } from '../../config/constants.js';
import { createBrandLead } from './brand-lead.service.js';

const leadSchema = z
  .object({
    nome: z.string().trim().min(2, 'Informe seu nome.').max(80),
    email: z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(160),
    telefone: z
      .string()
      .trim()
      .regex(/^[0-9()+\-.\s]{10,20}$/, 'Informe um telefone válido com DDD.'),
    mensagem: z.string().trim().min(5, 'Escreva uma mensagem.').max(1000),
  })
  .strict();

async function brandRoutes(app: FastifyInstance) {
  // Rota pública: a landing de marcas não exige login. Fica fora do
  // requireAuth de propósito, com limite próprio contra spam.
  app.post(
    '/brand-leads',
    { config: { rateLimit: RATE_LIMITS.BRAND_LEAD } },
    async (request, reply) => {
      const input = leadSchema.parse(request.body);
      const result = await createBrandLead(input, request.authUser?.id ?? null);
      return reply.status(201).send({ ok: true, duplicate: result.duplicate });
    },
  );
}

export default fp(brandRoutes, { name: 'brand-routes' });
