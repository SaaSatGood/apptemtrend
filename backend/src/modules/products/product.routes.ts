import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { reserveForceNew, reserveKitQuota, reserveFreeKitQuota, releaseForceNew, releaseFreeQuota, releaseQuota } from '../../lib/ai-metrics.js';
import { assertKitQuota, assertVariationQuota, planContextForCreator, planLimitError, variationsPolicy, vozPersonalizadaAllowed } from '../billing/billing.gating.js';
import { FAIR_USE_KITS_PER_MONTH, FREE_KITS_TOTAL } from '../billing/plans.js';
import { productQuerySchema } from './product.schema.js';
import * as productService from './product.service.js';
import { requireActiveCreator } from '../creators/creator.service.js';
import { Errors } from '../../types/index.js';
import type { Product } from '../../types/index.js';

function publicProduct(product: Product) {
  // Serializador enxuto da vitrine: só o que a UI do creator exibe.
  // Admin e geração usam linhas completas em endpoints próprios.
  const {
    id, produto_externo_id, nome, descricao, categoria, imagem_url, loja_nome,
    preco_texto, preco_min_brl, preco_max_brl, comissao_percentual,
    unidades_vendidas_periodo, unidades_vendidas_total,
    tiktok_shop_url, atualizado_em,
  } = product;
  return {
    id, produto_externo_id, nome, descricao, categoria, imagem_url, loja_nome,
    preco_texto, preco_min_brl, preco_max_brl, comissao_percentual,
    unidades_vendidas_periodo, unidades_vendidas_total,
    tiktok_shop_url, atualizado_em,
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
    await assertKitQuota(creator, body.force_new ? undefined : id);
    // Reabrir um roteiro existente não consome um dos três créditos gratuitos.
    if (!body.force_new && planContextForCreator(creator).plan === 'free') {
      const { content_kits } = await productService.getProductById(id, { creatorId: creator.id });
      if (content_kits[0]) return reply.status(200).send({ content_kit: content_kits[0], created: false });
    }
    // Plano pago não tem teto diário visível: o limite real é o uso justo
    // mensal (assertKitQuota). O contador diário segue registrando métricas,
    // mas com o mesmo teto mensal para nunca virar um "30/dia" escondido.
    const { plan } = planContextForCreator(creator);
    const releaseReservedQuota = () => plan === 'free'
      ? releaseFreeQuota(request.authUser.id, 'kit')
      : releaseQuota(request.authUser.id, 'kit');
    const reserved = plan === 'free'
      ? await reserveFreeKitQuota(request.authUser.id, creator.id, FREE_KITS_TOTAL)
      : await reserveKitQuota(request.authUser.id, FAIR_USE_KITS_PER_MONTH);
    if (!reserved) {
      throw plan === 'free'
        ? planLimitError(`Você usou os ${FREE_KITS_TOTAL} roteiros do plano Grátis. Assine Pro para continuar criando.`)
        : planLimitError('Você atingiu o limite de uso justo deste mês. Fale com a gente para ajustar seu plano e continuar criando.');
    }
    let forceReserved = false;
    let quotaReleased = false;
    try {
      if (body.force_new) {
        const policy = variationsPolicy(creator);
        if (!policy.allowed) {
          await releaseReservedQuota();
          quotaReleased = true;
          throw planLimitError('Gerar outra versão está disponível nos planos pagos. Faça upgrade para criar variações do roteiro.');
        }
        await assertVariationQuota(creator, id);
        forceReserved = await reserveForceNew(creator.id, id, policy.cooldownMs);
        if (!forceReserved) {
          await releaseReservedQuota();
          quotaReleased = true;
          throw Errors.CONFLICT(`Aguarde ${Math.round(policy.cooldownMs / 1000)} segundos antes de gerar outra versão para este produto.`);
        }
      }
      const voz = vozPersonalizadaAllowed(creator) ? creator.voz_exemplo ?? null : null;
      const result = body.force_new
        ? await productService.createFreshContentKit(id, creator.id, body.instructions, voz)
        : await productService.ensureContentKit(id, creator.id, body.instructions, voz);
      if (!result.created) {
        await releaseReservedQuota();
        quotaReleased = true;
      }
      return reply.status(result.created ? 201 : 200).send(result);
    } catch (error) {
      if (forceReserved) await releaseForceNew(creator.id, id);
      if (!quotaReleased) {
        await releaseReservedQuota();
      }
      throw error;
    }
  });
}

export default fp(productRoutes, { name: 'product-routes' });
