import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAdmin } from '../../plugins/auth.js';
import * as adminRepo from './admin.repository.js';
import * as creatorRepo from '../creators/creator.repository.js';
import * as productService from '../products/product.service.js';
import { listAllProducts, createProductWithContentKit } from '../products/product.repository.js';
import * as kitService from '../content-kits/content-kit.service.js';
import { createProductSchema, updateProductSchema } from '../products/product.schema.js';
import { createContentKitSchema, updateContentKitSchema } from '../content-kits/content-kit.schema.js';
import { supabaseAdmin } from '../../lib/supabase.js';

async function routes(app: FastifyInstance) {
  const admin = { preHandler: [requireAdmin], config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };
  app.get('/admin/dashboard', admin, async () => adminRepo.dashboard());
  app.get('/admin/creators', admin, async (request) => {
    const q = z.object({ status: z.string().optional(), nicho: z.string().optional() }).parse(request.query);
    const creators = await creatorRepo.listCreators(q);
    return Promise.all(creators.map(async (creator) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(creator.user_id);
      return { ...creator, email: data.user?.email ?? null, nome: data.user?.user_metadata?.full_name ?? null };
    }));
  });
  app.get('/admin/products', admin, async () => listAllProducts());
  app.get('/admin/products/:id', admin, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const product = await productService.getProductById(id);
    return product;
  });
  app.patch('/admin/creators/:id/status', admin, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { status } = z.object({ status: z.enum(['ativo', 'bloqueado']) }).parse(request.body);
    return creatorRepo.updateCreator(id, { status });
  });
  app.post('/admin/products', admin, async (request, reply) => {
    const input = createProductSchema.parse(request.body);
    return reply.status(201).send(await productService.createProduct(input, request.authUser.id));
  });
  app.post('/admin/products/complete', admin, async (request, reply) => {
    const body = z.object({
      product: createProductSchema,
      content_kit: createContentKitSchema,
    }).strict().parse(request.body);
    const result = await createProductWithContentKit(body.product, body.content_kit, request.authUser.id);
    return reply.status(201).send(result);
  });
  app.patch('/admin/products/:id', admin, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return productService.updateProductById(id, updateProductSchema.parse(request.body));
  });
  app.post('/admin/products/:id/content-kit', admin, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return reply.status(201).send(await kitService.createContentKit(id, createContentKitSchema.parse(request.body)));
  });
  app.patch('/admin/content-kits/:id', admin, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return kitService.updateContentKitById(id, updateContentKitSchema.parse(request.body));
  });
}
export default fp(routes, { name: 'admin-routes' });
