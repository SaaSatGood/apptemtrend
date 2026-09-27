import { findCreatorByUserId } from '../creators/creator.repository.js';
import { findContentKitById } from '../content-kits/content-kit.repository.js';
import { findProductById } from '../products/product.repository.js';
import {
  listCreatorContent,
  findCreatorContentById,
  findByCreatorAndKit,
  findByCreatorAndProduct,
  createCreatorContent,
  updateCreatorContent,
} from './creator-content.repository.js';
import { Errors } from '../../types/index.js';
import type { UpdateCreatorContentInput } from './creator-content.schema.js';

export async function getCreatorContent(userId: string) {
  const creator = await findCreatorByUserId(userId);
  if (!creator) {
    throw Errors.NOT_FOUND('Creator');
  }

  return listCreatorContent(creator.id);
}

export async function saveOpportunity(userId: string, contentKitId: string) {
  // 1. Find creator
  const creator = await findCreatorByUserId(userId);
  if (!creator) {
    throw Errors.NOT_FOUND('Creator');
  }

  // 2. Find content kit
  const contentKit = await findContentKitById(contentKitId);
  if (!contentKit) {
    throw Errors.NOT_FOUND('Content Kit');
  }

  // 3. Verify product is active
  const product = await findProductById(contentKit.product_id);
  if (!product || product.status === 'pausado') {
    throw Errors.BAD_REQUEST('Produto não está ativo.');
  }

  // 4. Check for duplicate
  const existing = await findByCreatorAndKit(creator.id, contentKitId);
  if (existing) {
    throw Errors.CONFLICT('Oportunidade já salva para este Content Kit.');
  }

  const productProduction = await findByCreatorAndProduct(creator.id, contentKit.product_id);
  if (productProduction) {
    if (!productProduction.content_kit_id) {
      return updateCreatorContent(productProduction.id, { content_kit_id: contentKitId });
    }
    throw Errors.CONFLICT('Este produto já está na sua produção.');
  }

  // 5. Create with status 'salvo'
  return createCreatorContent({
    creator_id: creator.id,
    content_kit_id: contentKitId,
    status: 'salvo',
  });
}

export async function saveProduct(userId: string, productId: string) {
  const creator = await findCreatorByUserId(userId);
  if (!creator) {
    throw Errors.NOT_FOUND('Creator');
  }

  const product = await findProductById(productId);
  if (!product || product.status === 'pausado') {
    throw Errors.BAD_REQUEST('Produto não está ativo.');
  }

  const existing = await findByCreatorAndProduct(creator.id, productId);
  if (existing) {
    throw Errors.CONFLICT('Este produto já está na sua produção.');
  }

  return createCreatorContent({
    creator_id: creator.id,
    product_id: productId,
    status: 'salvo',
  });
}

export async function updateCreatorContentStatus(
  userId: string,
  contentId: string,
  data: UpdateCreatorContentInput,
) {
  // 1. Find creator
  const creator = await findCreatorByUserId(userId);
  if (!creator) {
    throw Errors.NOT_FOUND('Creator');
  }

  // 2. Find creator_content
  const content = await findCreatorContentById(contentId);
  if (!content) {
    throw Errors.NOT_FOUND('Creator Content');
  }

  // 3. Verify ownership
  if (content.creator_id !== creator.id) {
    throw Errors.FORBIDDEN;
  }

  // 4. Update — system is not rigid about transitions
  return updateCreatorContent(contentId, data);
}
