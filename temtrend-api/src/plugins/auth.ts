import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { supabaseAdmin } from '../lib/supabase.js';
import { Errors, type AuthUser } from '../types/index.js';
import { logger } from '../lib/logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser;
    isAdmin: boolean;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('authUser');
  fastify.decorateRequest('isAdmin', false);
}

export default fp(authPlugin, { name: 'auth' });

// Hook: require authenticated user
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = Errors.UNAUTHORIZED;
    return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      const err = Errors.UNAUTHORIZED;
      return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
    }

    request.authUser = {
      id: data.user.id,
      email: data.user.email,
    };
  } catch (e) {
    logger.error({ err: e }, 'Auth verification failed');
    const err = Errors.UNAUTHORIZED;
    return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
  }
}

// Hook: require admin
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  // First ensure auth
  await requireAuth(request, reply);
  if (reply.sent) return;

  const { data, error } = await supabaseAdmin
    .from('admins')
    .select('id, user_id, nivel')
    .eq('user_id', request.authUser.id)
    .single();

  if (error || !data) {
    const err = Errors.FORBIDDEN;
    return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
  }

  request.isAdmin = true;
}
