import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAuth, clearAuthCachesForUser } from '../../plugins/auth.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { Errors, createAppError } from '../../types/index.js';
import { logger } from '../../lib/logger.js';
import { findCreatorByUserId, updateCreator } from '../creators/creator.repository.js';
import { effectivePlan } from '../billing/billing.gating.js';
import { cancelSubscriptionsForAccountDeletion } from '../billing/billing.service.js';
import { planLabel } from '../billing/plans.js';

const profileSchema = z.object({
  nome: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres.').max(120),
  voz_exemplo: z.string().trim().max(500).optional(),
}).strict();

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Informe sua senha atual.').max(200),
  new_password: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres.').max(128),
}).strict();

const deleteAccountSchema = z.object({
  confirm_email: z.string().trim().email('Informe o e-mail da conta.'),
  current_password: z.string().min(1).max(200).optional(),
}).strict();

type AuthUserRecord = {
  email?: string | null;
  app_metadata?: { provider?: string } | null;
  identities?: Array<{ provider?: string }> | null;
};

async function requireAuthUser(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) throw error ?? Errors.NOT_FOUND('Conta');
  return data.user;
}

/** Contas com identidade email/senha exigem reautenticação; OAuth puro não. */
function usesEmailPassword(user: AuthUserRecord): boolean {
  const provider = String(user.app_metadata?.provider ?? 'email');
  if (provider === 'email') return true;
  return (user.identities ?? []).some((identity) => identity.provider === 'email');
}

async function assertCurrentPassword(email: string | undefined, password: string | undefined): Promise<void> {
  if (!email) throw Errors.BAD_REQUEST('Sua conta não tem e-mail para confirmação.');
  if (!password) throw Errors.BAD_REQUEST('Informe sua senha atual para continuar.');
  const { error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  if (error) throw createAppError('INVALID_PASSWORD', 'Senha atual incorreta.', 401);
}

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
  const sensitive = { preHandler: [requireAuth], config: { rateLimit: RATE_LIMITS.SENSITIVE_WRITE } };

  app.get('/account', read, async (request, reply) => {
    const creatorQuery = supabaseAdmin
      .from('creators')
      .select('id, status, nicho, plataformas, tem_conta_afiliada, plan, plan_status, plan_period, trial_ends_at, current_period_end, cancel_at_period_end')
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
      plan: creatorPlan
        ? {
            nome: planLabel(effectivePlan(creatorPlan)),
            status: effectivePlan(creatorPlan) === 'free' ? 'active' : (creatorPlan.plan_status ?? 'active'),
            billing: true,
            trial_ends_at: creatorPlan.trial_ends_at ?? null,
            current_period_end: creatorPlan.current_period_end ?? null,
          }
        : { nome: 'Grátis', status: 'active', billing: true },
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

  app.post('/account/password', sensitive, async (request) => {
    const body = passwordSchema.parse(request.body ?? {});
    const user = await requireAuthUser(request.authUser.id);
    if (!usesEmailPassword(user)) {
      throw Errors.BAD_REQUEST('Sua conta usa login social. Altere a senha diretamente no provedor.');
    }
    if (body.current_password === body.new_password) {
      throw Errors.BAD_REQUEST('A nova senha precisa ser diferente da atual.');
    }
    await assertCurrentPassword(user.email ?? undefined, body.current_password);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(request.authUser.id, {
      password: body.new_password,
    });
    if (error) throw error;
    logger.info({ user_id: request.authUser.id }, 'Password updated after reauthentication');
    return { ok: true };
  });

  app.delete('/account', sensitive, async (request, reply) => {
    const body = deleteAccountSchema.parse(request.body ?? {});
    const user = await requireAuthUser(request.authUser.id);
    const email = (user.email ?? '').trim().toLowerCase();
    if (!email || body.confirm_email.trim().toLowerCase() !== email) {
      throw Errors.BAD_REQUEST('O e-mail informado não confere com o da conta.');
    }
    if (usesEmailPassword(user)) {
      await assertCurrentPassword(user.email ?? undefined, body.current_password);
    }

    // Cancela a cobrança recorrente ANTES de apagar o creator: o FK de
    // `subscriptions` é ON DELETE CASCADE e o id no provedor se perderia.
    const creator = await findCreatorByUserId(request.authUser.id);
    if (creator) await cancelSubscriptionsForAccountDeletion(creator.id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(request.authUser.id);
    if (error) throw error;
    clearAuthCachesForUser(request.authUser.id);
    logger.info({ user_id: request.authUser.id }, 'Account deleted');
    return reply.status(204).send();
  });
}

export default fp(routes, { name: 'account-routes' });
