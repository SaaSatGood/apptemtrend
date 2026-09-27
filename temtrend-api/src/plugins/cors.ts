import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { env } from '../config/env.js';

async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: env.NODE_ENV === 'production'
      ? env.CORS_ORIGIN.split(',')
      : [env.CORS_ORIGIN, 'http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}

export default fp(corsPlugin, { name: 'cors' });
