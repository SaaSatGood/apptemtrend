import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase.js';
import { CACHE_TTL_MS, RATE_LIMITS } from '../../config/constants.js';
import { logger } from '../../lib/logger.js';
import { TtlCache } from '../../lib/cache.js';

// Nomes permitidos: o funil inteiro em um lugar. Eventos fora da lista são
// recusados para manter o painel de métricas consistente.
export const ANALYTICS_EVENTS = [
  'landing_view',
  'landing_search',
  'pricing_view',
  'upgrade_click',
  'checkout_started',
  'trial_started',
  'signup_confirm_email',
  'email_verified',
  'signup_complete',
  'login_complete',
  'password_reset_complete',
  'onboarding_step',
  'onboarding_completed',
  'search_performed',
  'kit_created',
  'kit_generated',
  'saved_product_removed',
  'upgrade_cta_view',
  'paywall_view',
  'onboarding_skipped',
  'results_waitlist_click',
  'production_removed',
  'scene_recorded',
  'published',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

// Teto de props: telemetria é sinal, não dump de dados.
const MAX_PROPS_CHARS = 1000;

const eventSchema = z
  .object({
    name: z.enum(ANALYTICS_EVENTS),
    props: z
      .record(
        z.string().max(40),
        z.union([z.string().max(200), z.number(), z.boolean(), z.null()])
      )
      .optional(),
    path: z.string().max(200).optional(),
  })
  .strict();

const statsCache = new TtlCache<{ products: number; kits: number; searches: number; updatedAt: string }>(1);

async function countRows(table: string, status?: string) {
  let query = supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
  if (status) query = query.eq('status', status);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function routes(app: FastifyInstance) {
  // Números verificáveis da landing. Só contagens agregadas, nenhum dado pessoal.
  app.get('/stats', { config: { rateLimit: false } }, async (_request, reply) => {
    const cached = statsCache.get('stats');
    if (cached) return cached;

    try {
      const [products, kits, searches] = await Promise.all([
        countRows('products', 'ativo'),
        countRows('content_kits'),
        countRows('discovery_searches'),
      ]);
      const payload = {
        products,
        kits,
        searches,
        updatedAt: new Date().toISOString(),
      };
      statsCache.set('stats', payload, CACHE_TTL_MS.PUBLIC_STATS);
      return payload;
    } catch (error) {
      logger.error({ err: error }, 'Failed to load public stats');
      return reply.status(503).send({
        error: { code: 'STATS_UNAVAILABLE', message: 'Números indisponíveis agora.' },
      });
    }
  });

  app.post('/events', { config: { rateLimit: RATE_LIMITS.EVENTS } }, async (request, reply) => {
    const parsed = eventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'BAD_REQUEST', message: 'Evento inválido.' },
      });
    }

    const { name, props, path } = parsed.data;
    if (props && JSON.stringify(props).length > MAX_PROPS_CHARS) {
      return reply.status(400).send({
        error: { code: 'BAD_REQUEST', message: 'Evento inválido.' },
      });
    }

    const { error } = await supabaseAdmin.from('analytics_events').insert({
      user_id: request.authUser?.id ?? null,
      name,
      props: props ?? {},
      path: path ?? null,
    });

    if (error) {
      // Telemetria nunca derruba o fluxo do cliente.
      logger.error({ err: error, name }, 'Failed to record analytics event');
      return reply.status(202).send({ ok: false });
    }
    return reply.status(202).send({ ok: true });
  });
}

export default fp(routes, { name: 'analytics' });
