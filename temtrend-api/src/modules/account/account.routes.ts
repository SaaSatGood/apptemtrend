import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { Errors } from '../../types/index.js';

const profileSchema = z.object({
  nome: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres.').max(120),
}).strict();

async function routes(app: FastifyInstance) {
  const auth = { preHandler: [requireAuth], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

  app.get('/account', auth, async (request, reply) => {
    const [{ data: userData, error: userError }, { data: creator, error: creatorError }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(request.authUser.id),
      supabaseAdmin.from('creators').select('id, status, nicho, plataformas, tem_conta_afiliada').eq('user_id', request.authUser.id).maybeSingle(),
    ]);
    if (userError || !userData.user) return reply.status(404).send({ error: { code: Errors.NOT_FOUND('Conta').code, message: Errors.NOT_FOUND('Conta').message } });
    if (creatorError) throw creatorError;
    const metadata = userData.user.user_metadata ?? {};
    return {
      id: userData.user.id,
      email: userData.user.email ?? null,
      nome: metadata.full_name ?? metadata.name ?? metadata.nome ?? '',
      provider: userData.user.app_metadata?.provider ?? 'email',
      status: creator?.status ?? 'ativo',
      plan: { nome: 'Plano gratuito', status: 'ativo', billing: false },
    };
  });

  app.patch('/account/profile', auth, async (request) => {
    const { nome } = profileSchema.parse(request.body);
    const { data: current, error: currentError } = await supabaseAdmin.auth.admin.getUserById(request.authUser.id);
    if (currentError || !current.user) throw currentError ?? Errors.NOT_FOUND('Conta');
    const metadata = { ...(current.user.user_metadata ?? {}), full_name: nome, name: nome };
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(request.authUser.id, { user_metadata: metadata });
    if (error) throw error;
    return { nome: data.user?.user_metadata?.full_name ?? nome };
  });

  app.delete('/account', auth, async (request, reply) => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(request.authUser.id);
    if (error) throw error;
    return reply.status(204).send();
  });
}

export default fp(routes, { name: 'account-routes' });
