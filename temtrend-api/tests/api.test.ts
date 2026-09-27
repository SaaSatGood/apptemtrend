import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createProductSchema } from '../src/modules/products/product.schema.js';
import { updateCreatorContentSchema } from '../src/modules/creator-content/creator-content.schema.js';

describe('TemTrend Beta API', () => {
  it('exposes the health check', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('requires authentication for creator product discovery', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/products' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    await app.close();
  });

  it('rejects financial product fields', () => {
    const result = createProductSchema.safeParse({
      nome: 'Produto',
      imagem_url: 'https://example.com/image.png',
      preco: 10,
      comissao_pct: 20,
    });
    expect(result.success).toBe(false);
  });

  it('accepts only official production statuses', () => {
    expect(updateCreatorContentSchema.safeParse({ status: 'publicado' }).success).toBe(true);
    expect(updateCreatorContentSchema.safeParse({ status: 'cancelado' }).success).toBe(false);
  });

  it('returns a standard error for unknown routes', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('RESOURCE_NOT_FOUND');
    await app.close();
  });
});
