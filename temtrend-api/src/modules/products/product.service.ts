import { findProductById, listActiveProducts, createProduct as createProductRepo, updateProduct as updateProductRepo } from './product.repository.js';
import { listContentKitsByProductId } from '../content-kits/content-kit.repository.js';
import { Errors } from '../../types/index.js';
import { PRODUCT_STATUS } from '../../config/constants.js';
import type { CreateProductInput, UpdateProductInput } from './product.schema.js';

export async function getProducts(filters?: { categoria?: string; destaque?: boolean }) {
  const products = await listActiveProducts(filters);
  return products.filter((product) => product.status === PRODUCT_STATUS.ATIVO);
}

export async function getProductById(
  id: string,
  options: { includePaused?: boolean } = {},
) {
  const product = await findProductById(id);

  if (!product || (!options.includePaused && product.status === PRODUCT_STATUS.PAUSADO)) {
    throw Errors.NOT_FOUND('Produto');
  }

  const contentKits = await listContentKitsByProductId(id);

  return { product, content_kits: contentKits };
}

export async function createProduct(data: CreateProductInput, adminUserId: string) {
  return createProductRepo({
    ...data,
    criado_por: adminUserId,
  });
}

export async function updateProductById(id: string, data: UpdateProductInput) {
  const existing = await findProductById(id);

  if (!existing) {
    throw Errors.NOT_FOUND('Produto');
  }

  return updateProductRepo(id, data);
}
