import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { RATE_LIMITS } from '../../config/constants.js';
import { requestPasswordReset, resetPassword } from './recovery.service.js';

const requestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(254),
  })
  .strict();

const resetSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(254),
    code: z.string().trim().regex(/^\d{6}$/, 'Digite os 6 dígitos do código.'),
    password: z
      .string()
      .min(8, 'A nova senha precisa ter pelo menos 8 caracteres.')
      .max(128, 'A senha pode ter no máximo 128 caracteres.'),
  })
  .strict();

async function recoveryRoutes(app: FastifyInstance) {
  app.post(
    '/auth/password/request',
    { config: { rateLimit: RATE_LIMITS.PASSWORD_RESET_REQUEST } },
    async (request) => {
      const input = requestSchema.parse(request.body);
      await requestPasswordReset(input);
      // Resposta idêntica para conta existente, inexistente ou Google.
      return {
        ok: true,
        message:
          'Se este e-mail tiver uma conta com senha, o código chega em instantes. Contas criadas com Google devem entrar com Google.',
      };
    },
  );

  app.post(
    '/auth/password/reset',
    { config: { rateLimit: RATE_LIMITS.PASSWORD_RESET_SUBMIT } },
    async (request) => {
      const input = resetSchema.parse(request.body);
      await resetPassword(input);
      return { ok: true, message: 'Senha atualizada. Entre com a nova senha.' };
    },
  );
}

export default fp(recoveryRoutes, { name: 'recovery-routes' });
