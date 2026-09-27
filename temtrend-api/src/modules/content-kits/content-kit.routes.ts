import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

// Content kit routes are served through admin routes.
// This is a placeholder plugin for consistent module structure.
async function contentKitRoutes(_fastify: FastifyInstance) {
  // No public creator-facing content kit routes needed.
  // Content kits are accessed via GET /products/:id which returns them alongside the product.
}

export default fp(contentKitRoutes, { name: 'content-kit-routes' });
