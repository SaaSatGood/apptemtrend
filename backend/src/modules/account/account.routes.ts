import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAuth, clearAuthCachesForUser } from '../../plugins/auth.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { Errors } from '../../types/index.js';
import { logger } from '../../lib/logger.js';
import { findCreatorByUserId, updateCreator } from '../creators/creator.repository.js';
import { billingActive, effectivePlan } from '../billing/billing.gating.js';
import { planLabel } from '../billing/plans.js';

const profileSchema = z.object({
  nome: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres.').max(120),
  voz_exemplo: z.string().trim().max(500).optional(),
}).strict();

interface CreatorPlanView {
  id: string;
  plan?: string | null;
  plan_status?: string | null;
  plan_period?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
}

async function routes(app: FastifyInstance) {
  const read = { preHandler: [requireAuth], config: { rateLimit: RATE_LIMITS.AUTH_GET } };
  const write = { preHandler: [requireAuth], config: { rateLimit: RATE_LIMITS.AUTH_WRITE } };

  app.get('/account', read, async (request, reply) => {
    const billing = billingActive();
    // Colunas de plano só são lidas com billing ativo (migration 028 aplicada).
    // Strings literais: o cliente Supabase tipa o select em tempo de compilação.
    const creatorQuery = billing
      ? supabaseAdmin
          .from('creators')
          .select('id, status, nicho, plataformas, tem_conta_afiliada, plan, plan_status, plan_period, trial_ends_at, current_period_end, cancel_at_period_end')
          .eq('user_id', request.authUser.id)
          .maybeSingle()
      : supabaseAdmin
          .from('creators')
          .select('id, status, nicho, plataformas, tem_conta_afiliada')
          .eq('user_id', request.authUser.id)
          .maybeSingle();
    const [{ data: userData, error: userError }, { data: creator, error: creatorError }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(request.authUser.id),
      creatorQuery,
    ]);
    if (userError || !userData.user) return reply.status(404).send({ error: { code: Errors.NOT_FOUND('Conta').code, message: Errors.NOT_FOUND('Conta').message } });
    if (creatorError) throw creatorError;
    const creatorPlan = creator as CreatorPlanView | null;
    const metadata = userData.user.user_metadata ?? {};
    reply.header('cache-control', 'private, no-store');
    return {
      id: userData.user.id,
      email: userData.user.email ?? null,
      nome: metadata.full_name ?? metadata.name ?? metadata.nome ?? '',
      provider: userData.user.app_metadata?.provider ?? 'email',
      status: creator?.status ?? 'ativo',
      plan: billing && creatorPlan
        ? {
            nome: planLabel(effectivePlan(creatorPlan)),
            status: creatorPlan.plan_status ?? 'inactive',
            billing: true,
            trial_ends_at: creatorPlan.trial_ends_at ?? null,
            current_period_end: creatorPlan.current_period_end ?? null,
          }
        : { nome: 'Acesso completo (pré-lançamento)', status: 'ativo', billing: false },
    };
  });

  app.patch('/account/profile', write, async (request) => {
    const { nome, voz_exemplo } = profileSchema.parse(request.body);
    const { data: current, error: currentError } = await supabaseAdmin.auth.admin.getUserById(request.authUser.id);
    if (currentError || !current.user) throw currentError ?? Errors.NOT_FOUND('Conta');
    const metadata = { ...(current.user.user_metadata ?? {}), full_name: nome, name: nome };
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(request.authUser.id, { user_metadata: metadata });
    if (error) throw error;
    let voz: string | null | undefined;
    if (voz_exemplo !== undefined) {
      const creator = await findCreatorByUserId(request.authUser.id);
      if (!creator) throw Errors.NOT_FOUND('Creator');
      voz = voz_exemplo.trim() ? voz_exemplo.trim().slice(0, 500) : null;
      await updateCreator(creator.id, { voz_exemplo: voz });
    }
    return {
      nome: data.user?.user_metadata?.full_name ?? nome,
      ...(voz !== undefined ? { voz_exemplo: voz } : {}),
    };
  });

  app.delete('/account', write, async (request, reply) => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(request.authUser.id);
    if (error) throw error;
    clearAuthCachesForUser(request.authUser.id);
    logger.info({ user_id: request.authUser.id }, 'Account deleted');
    return reply.status(204).send();
  });
}

export default fp(routes, { name: 'account-routes' });
