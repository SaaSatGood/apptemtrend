import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { supabaseAdmin } from '../lib/supabase.js';
import { Errors, type AuthUser } from '../types/index.js';
import { logger } from '../lib/logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser;
    isAdmin: boolean;
    authFailed: boolean;
  }
}

const BEARER_PREFIX = 'Bearer ';

async function authenticate(request: FastifyRequest): Promise<boolean> {
  if (request.authUser) return true;
  if (request.authFailed) return false;

  const header = request.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) return false;

  const token = header.slice(BEARER_PREFIX.length);

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      request.authFailed = true;
      return false;
    }

    request.authUser = {
      id: data.user.id,
      email: data.user.email,
    };
    return true;
  } catch (e) {
    logger.error({ err: e }, 'Auth verification failed');
    request.authFailed = true;
    return false;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('authUser');
  fastify.decorateRequest('isAdmin', false);
  fastify.decorateRequest('authFailed', false);

  // Runs before the rate-limit hook (instance hooks always precede route hooks),
  // so the limiter can key on the authenticated user id.
  fastify.addHook('preValidation', async (request) => {
    if (request.headers.authorization) {
      await authenticate(request);
    }
  });
}

export default fp(authPlugin, { name: 'auth' });

// True when the auth user has a row in the `admins` table.
export async function isAdminUser(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('admins')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      logger.error({ err: error }, 'Error checking admin status');
    }
    return false;
  }

  return true;
}

// Hook: require authenticated user
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (await authenticate(request)) return;

  const err = Errors.UNAUTHORIZED;
  return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
}

// Hook: require admin
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  // First ensure auth
  await requireAuth(request, reply);
  if (reply.sent) return;

  if (!(await isAdminUser(request.authUser.id))) {
    const err = Errors.FORBIDDEN;
    return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
  }

  request.isAdmin = true;
}
