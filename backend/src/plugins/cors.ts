import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { env } from '../config/env.js';

async function corsPlugin(fastify: FastifyInstance) {
  const configured = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  await fastify.register(cors, {
    origin: env.NODE_ENV === 'production'
      ? configured
      : [
          ...configured,
          'http://localhost:3000',
          'http://localhost:5173',
        ],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}

export default fp(corsPlugin, { name: 'cors' });
