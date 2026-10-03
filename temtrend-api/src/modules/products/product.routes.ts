import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { productQuerySchema } from './product.schema.js';
import * as productService from './product.service.js';
import { requireActiveCreator } from '../creators/creator.service.js';
import type { Product } from '../../types/index.js';

function publicProduct(product: Product) {
  const {
    id, produto_externo_id, nome, descricao, categoria, imagem_url, loja_nome,
    preco_texto, preco_min_brl, preco_max_brl, pais_regiao, comissao_percentual,
    unidades_vendidas_periodo, crescimento_vendas_percentual, unidades_vendidas_total,
    receita_periodo_brl, receita_total_brl, data_estimada_upload,
    unidades_vendidas_total_loja, fastmoss_produto_url, tiktok_shop_url,
    fastmoss_loja_url, status_origem, ranking_origem, atualizado_em,
  } = product;
  return {
    id, produto_externo_id, nome, descricao, categoria, imagem_url, loja_nome,
    preco_texto, preco_min_brl, preco_max_brl, pais_regiao, comissao_percentual,
    unidades_vendidas_periodo, crescimento_vendas_percentual, unidades_vendidas_total,
    receita_periodo_brl, receita_total_brl, data_estimada_upload,
    unidades_vendidas_total_loja, fastmoss_produto_url, tiktok_shop_url,
    fastmoss_loja_url, status_origem, ranking_origem, atualizado_em,
  };
}

async function productRoutes(fastify: FastifyInstance) {
  // GET /products
  fastify.get('/products', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    await requireActiveCreator(request.authUser.id);
    const query = productQuerySchema.parse(request.query);
    const filters: { categoria?: string; destaque?: boolean; limit: number; offset: number } = {
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    };

    if (query.categoria) filters.categoria = query.categoria;
    if (query.destaque === 'true') filters.destaque = true;
    if (query.destaque === 'false') filters.destaque = false;

    const products = await productService.getProducts(filters);
    // Cache privado curto: catálogo muda via admin.
    reply.header('cache-control', 'private, max-age=30');
    return reply.send(products.map((product) => publicProduct(product)));
  });

  // GET /products/:id
  fastify.get('/products/:id', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const creator = await requireActiveCreator(request.authUser.id);
    const result = await productService.getProductById(id, { creatorId: creator.id });
    reply.header('cache-control', 'private, max-age=30');
    return reply.send({
      product: publicProduct(result.product),
      content_kits: result.content_kits,
    });
  });

  // POST /products/:id/content-kit — reutiliza por padrão; force_new é uma ação explícita do usuário
  fastify.post('/products/:id/content-kit', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.CONTENT_KIT_GENERATE },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      force_new: z.boolean().optional().default(false),
      instructions: z.string().trim().max(1500, 'Descreva o vídeo em até 1500 caracteres.').optional(),
    }).strict().parse(request.body ?? {});
    const creator = await requireActiveCreator(request.authUser.id);
    const result = body.force_new
      ? await productService.createFreshContentKit(id, creator.id, body.instructions)
      : await productService.ensureContentKit(id, creator.id, body.instructions);
    return reply.status(result.created ? 201 : 200).send(result);
  });
}

export default fp(productRoutes, { name: 'product-routes' });
