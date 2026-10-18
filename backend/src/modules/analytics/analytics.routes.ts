import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { logger } from '../../lib/logger.js';

// Nomes permitidos: o funil inteiro em um lugar. Eventos fora da lista são
// recusados para manter o painel de métricas consistente.
export const ANALYTICS_EVENTS = [
  'landing_view',
  'landing_search',
  'pricing_view',
  'upgrade_click',
  'signup_confirm_email',
  'signup_complete',
  'login_complete',
  'onboarding_step',
  'onboarding_completed',
  'search_performed',
  'kit_created',
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

async function routes(app: FastifyInstance) {
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
