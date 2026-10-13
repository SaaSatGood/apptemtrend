import { findCreatorByUserId } from '../creators/creator.repository.js';
import { findContentKitById } from '../content-kits/content-kit.repository.js';
import { findProductById } from '../products/product.repository.js';
import { ensureContentKit } from '../products/product.service.js';
import {
  listCreatorContent,
  findCreatorContentById,
  findCreatorContentWithRelationsById,
  findByCreatorAndKit,
  findByCreatorAndProduct,
  findAnyByCreatorAndProduct,
  createCreatorContent,
  updateCreatorContent,
} from './creator-content.repository.js';
import { Errors } from '../../types/index.js';
import type { UpdateCreatorContentInput } from './creator-content.schema.js';
import { CONTENT_STATUS, PRODUCT_STATUS } from '../../config/constants.js';

const NEXT_STATUS: Record<string, string> = {
  [CONTENT_STATUS.SALVO]: CONTENT_STATUS.EM_PRODUCAO,
  [CONTENT_STATUS.EM_PRODUCAO]: CONTENT_STATUS.GRAVADO,
  [CONTENT_STATUS.GRAVADO]: CONTENT_STATUS.PUBLICADO,
};

async function requireCreator(userId: string) {
  const creator = await findCreatorByUserId(userId);
  if (!creator) throw Errors.NOT_FOUND('Creator');
  if (creator.status === 'bloqueado') throw Errors.FORBIDDEN;
  return creator;
}

async function requireOwnedProduction(userId: string, contentId: string) {
  const [creator, content] = await Promise.all([
    requireCreator(userId),
    findCreatorContentById(contentId),
  ]);
  if (!content) throw Errors.NOT_FOUND('Produção');
  if (content.creator_id !== creator.id) throw Errors.FORBIDDEN;
  return { creator, content };
}

export async function getCreatorContent(userId: string, options?: { limit?: number; offset?: number }) {
  const creator = await requireCreator(userId);
  // Compat: sem paginação repassa 1 arg (coberto por teste).
  if (!options) return listCreatorContent(creator.id);
  return listCreatorContent(creator.id, options);
}

export async function getCreatorContentById(userId: string, contentId: string) {
  const { creator } = await requireOwnedProduction(userId, contentId);
  const content = await findCreatorContentWithRelationsById(contentId);
  if (!content || content.creator_id !== creator.id) throw Errors.NOT_FOUND('Produção');
  return content;
}

export async function startProduction(userId: string, productId: string, briefing?: string) {
  const creator = await requireCreator(userId);
  const [product, existing] = await Promise.all([
    findProductById(productId),
    findAnyByCreatorAndProduct(creator.id, productId),
  ]);
  if (!product || product.status !== PRODUCT_STATUS.ATIVO) throw Errors.NOT_FOUND('Produto');

  if (existing?.content_kit_id) return existing;

  const { content_kit: contentKit } = await ensureContentKit(productId, creator.id, briefing);
  const current = existing ?? await findAnyByCreatorAndProduct(creator.id, productId);

  if (current) {
    if (current.content_kit_id) return current;
    return updateCreatorContent(current.id, { content_kit_id: contentKit.id });
  }

  try {
    return await createCreatorContent({
      creator_id: creator.id,
      product_id: productId,
      content_kit_id: contentKit.id,
      status: CONTENT_STATUS.SALVO,
    });
  } catch (error) {
    // Corrida double-submit: unique parcial -> relê e retorna existente.
    if ((error as { code?: string }).code === '23505') {
      const raced = await findAnyByCreatorAndProduct(creator.id, productId);
      if (raced) return raced;
    }
    throw error;
  }
}

export async function selectContentKit(userId: string, contentId: string, contentKitId: string) {
  const { creator, content } = await requireOwnedProduction(userId, contentId);
  const kit = await findContentKitById(contentKitId);
  if (!kit || kit.product_id !== content.product_id || kit.creator_id !== creator.id) {
    throw Errors.BAD_REQUEST('O Content Kit não pertence a esta produção.');
  }
  if (content.status !== CONTENT_STATUS.SALVO && content.content_kit_id !== contentKitId) {
    throw Errors.CONFLICT('Esta produção já possui um Content Kit escolhido.');
  }
  if (content.content_kit_id === contentKitId && content.status !== CONTENT_STATUS.SALVO) return content;
  return updateCreatorContent(contentId, {
    content_kit_id: contentKitId,
    status: CONTENT_STATUS.EM_PRODUCAO,
  });
}

export async function saveOpportunity(userId: string, contentKitId: string) {
  // Creator + kit independentes: busca em paralelo.
  const [creator, contentKit] = await Promise.all([
    findCreatorByUserId(userId),
    findContentKitById(contentKitId),
  ]);
  if (!creator) {
    throw Errors.NOT_FOUND('Creator');
  }
  if (creator.status === 'bloqueado') throw Errors.FORBIDDEN;

  if (!contentKit || contentKit.creator_id !== creator.id) {
    throw Errors.NOT_FOUND('Content Kit');
  }

  const [product, existing, productProduction] = await Promise.all([
    findProductById(contentKit.product_id),
    findByCreatorAndKit(creator.id, contentKitId),
    findByCreatorAndProduct(creator.id, contentKit.product_id),
  ]);
  if (!product || product.status === 'pausado') {
    throw Errors.BAD_REQUEST('Produto não está ativo.');
  }

  // 4. Check for duplicate
  if (existing) {
    return existing.status === CONTENT_STATUS.SALVO
      ? updateCreatorContent(existing.id, { status: CONTENT_STATUS.EM_PRODUCAO })
      : existing;
  }

  if (productProduction) {
    if (!productProduction.content_kit_id) {
      return updateCreatorContent(productProduction.id, {
        content_kit_id: contentKitId,
        status: CONTENT_STATUS.EM_PRODUCAO,
      });
    }
    return productProduction;
  }

  // Legacy shortcut: choosing a Content Kit means production has started.
  try {
    return await createCreatorContent({
      creator_id: creator.id,
      product_id: contentKit.product_id,
      content_kit_id: contentKitId,
      status: CONTENT_STATUS.EM_PRODUCAO,
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      const raced = await findByCreatorAndKit(creator.id, contentKitId);
      if (raced) return raced;
      const racedProduct = await findAnyByCreatorAndProduct(creator.id, contentKit.product_id);
      if (racedProduct) return racedProduct;
    }
    throw error;
  }
}

export async function updateCreatorContentStatus(
  userId: string,
  contentId: string,
  data: UpdateCreatorContentInput,
) {
  const { content } = await requireOwnedProduction(userId, contentId);
  if (data.status && data.status !== content.status) {
    if (NEXT_STATUS[content.status] !== data.status) {
      throw Errors.CONFLICT('Transição de status inválida para esta produção.');
    }
    if (data.status === CONTENT_STATUS.EM_PRODUCAO && !content.content_kit_id) {
      throw Errors.BAD_REQUEST('Escolha um Content Kit antes de produzir o vídeo.');
    }
  }
  if (data.published_url !== undefined && data.status !== CONTENT_STATUS.PUBLICADO && content.status !== CONTENT_STATUS.PUBLICADO) {
    throw Errors.BAD_REQUEST('O link só pode ser salvo ao marcar a produção como publicada.');
  }
  return updateCreatorContent(contentId, data);
}
