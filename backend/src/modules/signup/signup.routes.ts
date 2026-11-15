import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { RATE_LIMITS } from '../../config/constants.js';
import { resendCode, signup, verifyCode, CODE_TTL_SECONDS } from './signup.service.js';

const signupSchema = z
  .object({
    nome: z.string().trim().min(2, 'Informe seu nome com pelo menos 2 caracteres.').max(120),
    email: z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(254),
    password: z
      .string()
      .min(6, 'A senha precisa ter pelo menos 6 caracteres.')
      .max(128, 'A senha pode ter no máximo 128 caracteres.'),
  })
  .strict();

const verifySchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(254),
    code: z.string().trim().regex(/^\d{6}$/, 'Digite os 6 dígitos do código.'),
  })
  .strict();

const resendSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(254),
  })
  .strict();

// Rotas públicas: o cadastro acontece antes de existir sessão. Cada uma tem
// limite próprio por IP, além do throttle de 1 minuto por e-mail no serviço.
async function signupRoutes(app: FastifyInstance) {
  app.post(
    '/auth/signup',
    { config: { rateLimit: RATE_LIMITS.SIGNUP } },
    async (request, reply) => {
      const input = signupSchema.parse(request.body);
      const result = await signup(input);
      return reply.status(201).send({
        ok: true,
        email: result.email,
        code_ttl_seconds: CODE_TTL_SECONDS,
      });
    },
  );

  app.post(
    '/auth/verify-code',
    { config: { rateLimit: RATE_LIMITS.VERIFY_CODE } },
    async (request) => {
      const input = verifySchema.parse(request.body);
      const result = await verifyCode(input);
      return { ok: true, verified: true, email: result.email };
    },
  );

  app.post(
    '/auth/resend-code',
    { config: { rateLimit: RATE_LIMITS.RESEND_CODE } },
    async (request) => {
      const input = resendSchema.parse(request.body);
      await resendCode(input.email);
      // Resposta sempre igual: não revela se a conta existe.
      return { ok: true };
    },
  );
}

export default fp(signupRoutes, { name: 'signup-routes' });
