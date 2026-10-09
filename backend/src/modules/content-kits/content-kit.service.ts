import { findContentKitById, createContentKit as createRepo, updateContentKit as updateRepo } from './content-kit.repository.js';
import { findProductById } from '../products/product.repository.js';
import { Errors } from '../../types/index.js';
import type { CreateContentKitInput, UpdateContentKitInput } from './content-kit.schema.js';

export async function createContentKit(productId: string, data: CreateContentKitInput) {
  const product = await findProductById(productId);
  if (!product) {
    throw Errors.NOT_FOUND('Produto');
  }

  return createRepo(productId, data);
}

export async function updateContentKitById(id: string, data: UpdateContentKitInput) {
  const existing = await findContentKitById(id);
  if (!existing) {
    throw Errors.NOT_FOUND('Content Kit');
  }

  return updateRepo(id, data);
}
