import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { TtlCache } from '../lib/cache.js';
import { CACHE_TTL_MS } from '../config/constants.js';
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

// Cache por hash do token: evita 1 roundtrip ao Supabase por request.
// TTL curto para não segurar revogação por muito tempo.
const authUserCache = new TtlCache<AuthUser>(2000);
const adminFlagCache = new TtlCache<boolean>(1000);

function tokenCacheKey(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function authenticate(request: FastifyRequest): Promise<boolean> {
  if (request.authUser) return true;
  if (request.authFailed) return false;

  const header = request.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) return false;

  const token = header.slice(BEARER_PREFIX.length);
  if (!token) return false;

  const cacheKey = tokenCacheKey(token);
  const cached = authUserCache.get(cacheKey);
  if (cached) {
    request.authUser = cached;
    return true;
  }

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
    authUserCache.set(cacheKey, request.authUser, CACHE_TTL_MS.AUTH_USER);
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
  const cached = adminFlagCache.get(userId);
  if (cached !== undefined) return cached;

  const { data, error } = await supabaseAdmin
    .from('admins')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      logger.error({ err: error }, 'Error checking admin status');
    }
    // Cache negativo curto para não martelar o banco em loops de 403.
    adminFlagCache.set(userId, false, 60 * 1000);
    return false;
  }

  adminFlagCache.set(userId, true, CACHE_TTL_MS.ADMIN_FLAG);
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

export function clearAuthCachesForUser(userId: string) {
  adminFlagCache.delete(userId);
  // Tokens são chaveados por hash; limpeza total é mais segura no delete.
  authUserCache.clear();
}
