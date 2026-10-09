import { describe, expect, it, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../src/modules/creators/creator.repository.js', () => ({
  findCreatorByUserId: vi.fn(),
  updateCreator: vi.fn(),
}));
vi.mock('../src/modules/products/product.repository.js', () => ({
  findProductById: vi.fn(),
  listActiveProducts: vi.fn(),
}));
vi.mock('../src/modules/content-kits/content-kit.repository.js', () => ({
  findContentKitById: vi.fn(),
  listContentKitsByProductId: vi.fn(),
}));
vi.mock('../src/modules/creator-content/creator-content.repository.js', () => ({
  listCreatorContent: vi.fn(),
  findCreatorContentById: vi.fn(),
  findCreatorContentWithRelationsById: vi.fn(),
  findByCreatorAndKit: vi.fn(),
  findByCreatorAndProduct: vi.fn(),
  findAnyByCreatorAndProduct: vi.fn(),
  createCreatorContent: vi.fn(),
  updateCreatorContent: vi.fn(),
}));

import * as creatorRepo from '../src/modules/creators/creator.repository.js';
import * as creatorService from '../src/modules/creators/creator.service.js';
import * as creatorContentService from '../src/modules/creator-content/creator-content.service.js';
import * as creatorContentRepo from '../src/modules/creator-content/creator-content.repository.js';
import { createProductSchema, updateProductSchema } from '../src/modules/products/product.schema.js';
import { updateCreatorContentSchema } from '../src/modules/creator-content/creator-content.schema.js';

describe('MVP hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bloqueia creator com status bloqueado', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue({ id: 'c1', status: 'bloqueado' } as never);
    await expect(creatorService.requireActiveCreator('u1')).rejects.toMatchObject({ statusCode: 403 });
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue({ id: 'c1', status: 'ativo' } as never);
    await expect(creatorService.requireActiveCreator('u1')).resolves.toMatchObject({ id: 'c1' });
  });

  it('creator bloqueado não lista produção', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue({ id: 'c1', status: 'bloqueado' } as never);
    await expect(creatorContentService.getCreatorContent('u1')).rejects.toMatchObject({ statusCode: 403 });
    expect(creatorContentRepo.listCreatorContent).not.toHaveBeenCalled();
  });

  it('saveOpportunity é idempotente em corrida 23505', async () => {
    const creator = { id: 'c1', status: 'ativo' };
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creator as never);
    const kit = { id: 'k1', product_id: 'p1', creator_id: 'c1' };
    const { findContentKitById } = await import('../src/modules/content-kits/content-kit.repository.js');
    const { findProductById } = await import('../src/modules/products/product.repository.js');
    vi.mocked(findContentKitById).mockResolvedValue(kit as never);
    vi.mocked(findProductById).mockResolvedValue({ id: 'p1', status: 'ativo' } as never);
    vi.mocked(creatorContentRepo.findByCreatorAndKit)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'ok' } as never);
    vi.mocked(creatorContentRepo.findByCreatorAndProduct).mockResolvedValue(null);
    vi.mocked(creatorContentRepo.createCreatorContent).mockRejectedValueOnce({ code: '23505' });
    const result = await creatorContentService.saveOpportunity('u1', 'k1');
    expect(result).toMatchObject({ id: 'ok' });
  });

  it('produto rejeita preço min maior que max e data inválida', () => {
    expect(createProductSchema.safeParse({
      nome: 'P', imagem_url: 'https://example.com/a.png',
      preco_min_brl: 100, preco_max_brl: 50,
    }).success).toBe(false);
    expect(createProductSchema.safeParse({
      nome: 'P', imagem_url: 'https://example.com/a.png',
      data_estimada_upload: 'não-é-data',
    }).success).toBe(false);
    expect(updateProductSchema.safeParse({ preco_min_brl: 10, preco_max_brl: 5 }).success).toBe(false);
  });

  it('publication aceita vm/vt tiktok e rejeita externo', () => {
    expect(updateCreatorContentSchema.safeParse({ status: 'publicado', published_url: 'https://vm.tiktok.com/abc' }).success).toBe(true);
    expect(updateCreatorContentSchema.safeParse({ status: 'publicado', published_url: 'https://vt.tiktok.com/abc' }).success).toBe(true);
    expect(updateCreatorContentSchema.safeParse({ status: 'publicado', published_url: 'https://example.com/v' }).success).toBe(false);
  });

  it('migration 020 restringe catálogo a authenticated', () => {
    const sql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/020_rls_hardening.sql'), 'utf8');
    expect(sql).toContain('TO authenticated');
    expect(sql).toContain('products_select_active');
  });

  it('migration 019 cria índices de performance', () => {
    const sql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/019_performance_indexes.sql'), 'utf8');
    expect(sql).toContain('idx_products_status_ordem_criado');
    expect(sql).toContain('idx_creator_content_creator_product');
  });
});
