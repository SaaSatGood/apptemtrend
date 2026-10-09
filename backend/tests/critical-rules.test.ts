import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../src/modules/creators/creator.repository.js', () => ({
  findCreatorByUserId: vi.fn(),
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
vi.mock('../src/modules/content-kits/content-kit.repository.js', () => ({
  findContentKitById: vi.fn(),
  listContentKitsByProductId: vi.fn(),
}));
vi.mock('../src/modules/products/product.repository.js', () => ({
  findProductById: vi.fn(),
  findProductByExternalId: vi.fn(),
  listActiveProducts: vi.fn(),
  createProductWithContentKit: vi.fn(),
}));

import * as creatorRepo from '../src/modules/creators/creator.repository.js';
import * as creatorContentRepo from '../src/modules/creator-content/creator-content.repository.js';
import * as kitRepo from '../src/modules/content-kits/content-kit.repository.js';
import * as productRepo from '../src/modules/products/product.repository.js';
import * as creatorContentService from '../src/modules/creator-content/creator-content.service.js';
import * as productService from '../src/modules/products/product.service.js';
import * as assistantService from '../src/modules/assistant/assistant.service.js';
import { createProductSchema, updateProductSchema } from '../src/modules/products/product.schema.js';
import { createContentKitSchema } from '../src/modules/content-kits/content-kit.schema.js';
import { createCreatorContentSchema, updateCreatorContentSchema } from '../src/modules/creator-content/creator-content.schema.js';
import { requireAuth, requireAdmin } from '../src/plugins/auth.js';
import { supabaseAdmin } from '../src/lib/supabase.js';
import { RATE_LIMITS } from '../src/config/constants.js';

const creatorA = { id: '11111111-1111-4111-8111-111111111111', user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
const creatorB = { id: '22222222-2222-4222-8222-222222222222', user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
const kit = {
  id: '33333333-3333-4333-8333-333333333333',
  product_id: '44444444-4444-4444-8444-444444444444',
  creator_id: creatorA.id,
};

function replyMock() {
  const reply: any = { sent: false };
  reply.status = vi.fn(() => reply);
  reply.send = vi.fn((body) => { reply.sent = true; return body; });
  return reply;
}

describe('critical Beta rules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts a valid JWT and rejects an invalid JWT', async () => {
    const getUser = vi.spyOn(supabaseAdmin.auth, 'getUser');
    const request: any = { headers: { authorization: 'Bearer valid-token' } };
    const reply = replyMock();
    getUser.mockResolvedValueOnce({ data: { user: { id: creatorA.user_id, email: 'a@example.com' } }, error: null } as any);
    await requireAuth(request, reply);
    expect(request.authUser.id).toBe(creatorA.user_id);

    const invalidReply = replyMock();
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('invalid') } as any);
    await requireAuth({ headers: { authorization: 'Bearer invalid-token' } } as any, invalidReply);
    expect(invalidReply.status).toHaveBeenCalledWith(401);
  });

  it('prevents creator A from reading or changing creator B data', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(creatorContentRepo.findCreatorContentById).mockResolvedValue({ creator_id: creatorB.id } as any);
    await expect(creatorContentService.updateCreatorContentStatus(creatorA.user_id, '55555555-5555-4555-8555-555555555555', { status: 'gravado' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    expect(creatorContentRepo.updateCreatorContent).not.toHaveBeenCalled();
  });

  it('returns 403 when a creator is not an admin', async () => {
    vi.spyOn(supabaseAdmin.auth, 'getUser').mockResolvedValue({ data: { user: { id: creatorA.user_id } }, error: null } as any);
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), single: vi.fn().mockResolvedValue({ data: null, error: new Error('not admin') }) };
    vi.spyOn(supabaseAdmin, 'from').mockReturnValue(query as any);
    const reply = replyMock();
    await requireAdmin({ headers: { authorization: 'Bearer creator-token' } } as any, reply);
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it('validates administrative product creation and editing fields', () => {
    expect(createProductSchema.safeParse({
      produto_externo_id: '1736030542580909455',
      nome: 'Produto',
      descricao: 'Descrição confirmada',
      categoria: 'Beleza',
      imagem_url: 'https://example.com/a.png',
      preco_texto: 'R$ 39,90',
      preco_min_brl: 39.90,
      comissao_percentual: 12,
      tiktok_shop_url: 'https://shop.tiktok.com/view/product/1736030542580909455',
      status: 'ativo',
    }).success).toBe(true);
    expect(createProductSchema.safeParse({ nome: 'Produto', imagem_url: 'https://example.com/a.png', campo_inventado: 99 }).success).toBe(false);
    expect(createProductSchema.safeParse({ nome: 'Produto', imagem_url: 'https://example.com/a.png', comissao_percentual: 120 }).success).toBe(false);
    expect(updateProductSchema.safeParse({ status: 'pausado', destaque: true, ordem_destaque: 2 }).success).toBe(true);
  });

  it('validates and creates a Content Kit payload', () => {
    const result = createContentKitSchema.safeParse({ titulo: 'Review curto', formato: 'reels', plataforma: 'TikTok', hook: 'Você precisa ver isso', roteiro: 'Cena 1', cta: 'Confira', duracao_seg: 30 });
    expect(result.success).toBe(true);
    expect(createContentKitSchema.safeParse({ titulo: '', duracao_seg: 0 }).success).toBe(false);
  });

  it('never exposes paused products to creators', async () => {
    vi.mocked(productRepo.listActiveProducts).mockResolvedValue([{ id: '1', status: 'ativo' }, { id: '2', status: 'pausado' }] as any);
    const result = await productService.getProducts();
    expect(productRepo.listActiveProducts).toHaveBeenCalledWith(undefined);
    expect(result).toHaveLength(1);
    expect(result.some((product: any) => product.status === 'pausado')).toBe(false);
  });

  it('keeps paused products hidden from creators but readable by admins', async () => {
    vi.mocked(productRepo.findProductById).mockResolvedValue({ id: kit.product_id, status: 'pausado' } as any);
    vi.mocked(kitRepo.listContentKitsByProductId).mockResolvedValue([] as any);

    await expect(productService.getProductById(kit.product_id))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(productService.getProductById(kit.product_id, { includePaused: true }))
      .resolves.toMatchObject({ product: { status: 'pausado' } });
  });

  it('returns only Content Kits owned by the authenticated creator', async () => {
    vi.mocked(productRepo.findProductById).mockResolvedValue({ id: kit.product_id, status: 'ativo' } as any);
    vi.mocked(kitRepo.listContentKitsByProductId).mockResolvedValue([kit] as any);

    await productService.getProductById(kit.product_id, { creatorId: creatorA.id });

    expect(kitRepo.listContentKitsByProductId).toHaveBeenCalledWith(kit.product_id, creatorA.id);
  });

  it('creates creator_content with creator identity from the JWT and blocks another owner', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(kitRepo.findContentKitById).mockResolvedValue(kit as any);
    vi.mocked(productRepo.findProductById).mockResolvedValue({ id: kit.product_id, status: 'ativo' } as any);
    vi.mocked(creatorContentRepo.findByCreatorAndKit).mockResolvedValue(null);
    vi.mocked(creatorContentRepo.findByCreatorAndProduct).mockResolvedValue(null);
    vi.mocked(creatorContentRepo.createCreatorContent).mockResolvedValue({ creator_id: creatorA.id, product_id: kit.product_id, content_kit_id: kit.id, status: 'em_producao' } as any);
    const created = await creatorContentService.saveOpportunity(creatorA.user_id, kit.id);
    expect(creatorContentRepo.createCreatorContent).toHaveBeenCalledWith({ creator_id: creatorA.id, product_id: kit.product_id, content_kit_id: kit.id, status: 'em_producao' });
    expect(created.creator_id).toBe(creatorA.id);
    expect(createCreatorContentSchema.safeParse({ content_kit_id: kit.id, creator_id: creatorB.id }).success).toBe(false);
  });

  it('starts a production from an active real product', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(productRepo.findProductById).mockResolvedValue({ id: kit.product_id, status: 'ativo' } as any);
    vi.mocked(kitRepo.listContentKitsByProductId).mockResolvedValue([kit] as any);
    vi.mocked(creatorContentRepo.findAnyByCreatorAndProduct).mockResolvedValue(null);
    vi.mocked(creatorContentRepo.createCreatorContent).mockResolvedValue({ id: 'content', creator_id: creatorA.id, product_id: kit.product_id, content_kit_id: kit.id, status: 'salvo' } as any);
    await creatorContentService.startProduction(creatorA.user_id, kit.product_id);
    expect(creatorContentRepo.createCreatorContent).toHaveBeenCalledWith({ creator_id: creatorA.id, product_id: kit.product_id, content_kit_id: kit.id, status: 'salvo' });
  });

  it('adds the Content Kit when an older saved product does not have one', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(productRepo.findProductById).mockResolvedValue({ id: kit.product_id, status: 'ativo' } as any);
    vi.mocked(kitRepo.listContentKitsByProductId).mockResolvedValue([kit] as any);
    vi.mocked(creatorContentRepo.findAnyByCreatorAndProduct).mockResolvedValue({
      id: 'content', creator_id: creatorA.id, product_id: kit.product_id, content_kit_id: null, status: 'salvo',
    } as any);
    vi.mocked(creatorContentRepo.updateCreatorContent).mockResolvedValue({
      id: 'content', creator_id: creatorA.id, product_id: kit.product_id, content_kit_id: kit.id, status: 'salvo',
    } as any);

    await creatorContentService.startProduction(creatorA.user_id, kit.product_id);

    expect(creatorContentRepo.updateCreatorContent).toHaveBeenCalledWith('content', { content_kit_id: kit.id });
    expect(creatorContentRepo.createCreatorContent).not.toHaveBeenCalled();
  });

  it('selects only a Content Kit that belongs to the owned production', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(creatorContentRepo.findCreatorContentById).mockResolvedValue({ id: 'content', creator_id: creatorA.id, product_id: kit.product_id, status: 'salvo', content_kit_id: null } as any);
    vi.mocked(kitRepo.findContentKitById).mockResolvedValue(kit as any);
    vi.mocked(creatorContentRepo.updateCreatorContent).mockResolvedValue({ id: 'content', status: 'em_producao', content_kit_id: kit.id } as any);
    await creatorContentService.selectContentKit(creatorA.user_id, 'content', kit.id);
    expect(creatorContentRepo.updateCreatorContent).toHaveBeenCalledWith('content', { content_kit_id: kit.id, status: 'em_producao' });
  });

  it('rejects a Content Kit owned by another creator', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(creatorContentRepo.findCreatorContentById).mockResolvedValue({
      id: 'content', creator_id: creatorA.id, product_id: kit.product_id, status: 'salvo', content_kit_id: null,
    } as any);
    vi.mocked(kitRepo.findContentKitById).mockResolvedValue({ ...kit, creator_id: creatorB.id } as any);

    await expect(creatorContentService.selectContentKit(creatorA.user_id, 'content', kit.id))
      .rejects.toMatchObject({ code: 'BAD_REQUEST', statusCode: 400 });
    expect(creatorContentRepo.updateCreatorContent).not.toHaveBeenCalled();
  });

  it('reuses the existing production and normalizes a legacy saved Content Kit', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(kitRepo.findContentKitById).mockResolvedValue(kit as any);
    vi.mocked(productRepo.findProductById).mockResolvedValue({ id: kit.product_id, status: 'ativo' } as any);
    const existing = { id: '55555555-5555-4555-8555-555555555555', creator_id: creatorA.id, content_kit_id: kit.id, status: 'salvo' };
    vi.mocked(creatorContentRepo.findByCreatorAndKit).mockResolvedValue(existing as any);
    const normalized = { ...existing, status: 'em_producao' };
    vi.mocked(creatorContentRepo.updateCreatorContent).mockResolvedValue(normalized as any);
    await expect(creatorContentService.saveOpportunity(creatorA.user_id, kit.id)).resolves.toEqual(normalized);
    expect(creatorContentRepo.updateCreatorContent).toHaveBeenCalledWith(existing.id, { status: 'em_producao' });
    expect(creatorContentRepo.createCreatorContent).not.toHaveBeenCalled();
  });

  it('returns a not found error for an unknown Content Kit', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(kitRepo.findContentKitById).mockResolvedValue(null);
    await expect(creatorContentService.saveOpportunity(creatorA.user_id, kit.id))
      .rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', statusCode: 404 });
  });

  it('allows status, notes and a TikTok publication URL but blocks immutable fields', () => {
    for (const status of ['salvo', 'em_producao', 'gravado', 'publicado']) {
      expect(updateCreatorContentSchema.safeParse({ status }).success).toBe(true);
    }
    expect(updateCreatorContentSchema.safeParse({ published_url: 'https://www.tiktok.com/@creator/video/123' }).success).toBe(true);
    expect(updateCreatorContentSchema.safeParse({ published_url: 'https://example.com/video' }).success).toBe(false);
    expect(updateCreatorContentSchema.safeParse({ creator_id: creatorB.id }).success).toBe(false);
    expect(updateCreatorContentSchema.safeParse({ content_kit_id: kit.id }).success).toBe(false);
    expect(updateCreatorContentSchema.safeParse({}).success).toBe(false);
  });

  it('updates only a production owned by the authenticated creator', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(creatorContentRepo.findCreatorContentById).mockResolvedValue({ id: 'content', creator_id: creatorA.id, status: 'em_producao', content_kit_id: kit.id } as any);
    vi.mocked(creatorContentRepo.updateCreatorContent).mockResolvedValue({ id: 'content', creator_id: creatorA.id, status: 'gravado' } as any);
    await creatorContentService.updateCreatorContentStatus(creatorA.user_id, 'content', { status: 'gravado' });
    expect(creatorContentRepo.updateCreatorContent).toHaveBeenCalledWith('content', { status: 'gravado' });
  });

  it('rejects skipped or backwards production transitions', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(creatorContentRepo.findCreatorContentById).mockResolvedValue({ id: 'content', creator_id: creatorA.id, status: 'salvo', content_kit_id: null } as any);
    await expect(creatorContentService.updateCreatorContentStatus(creatorA.user_id, 'content', { status: 'gravado' }))
      .rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });
  });

  it('returns only real active catalog products from the assistant', async () => {
    const catalog = [
      { id: '1', nome: 'Faixa elástica', categoria: 'Fitness', descricao: 'Treino em casa', imagem_url: 'https://example.com/faixa.jpg', destaque: false },
      { id: '2', nome: 'Organizador', categoria: 'Casa', descricao: 'Organização simples', imagem_url: 'https://example.com/organizador.jpg', destaque: true },
    ];
    vi.mocked(productRepo.listActiveProducts).mockResolvedValue(catalog as any);
    const result = await assistantService.findProductsForMessage({ message: 'Quero vender produtos para academia' });
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.id).toBe('1');
    expect(result.products.every((product) => catalog.some((item) => item.id === product.id))).toBe(true);
  });

  it('recognizes clear product requests for the generation fallback', () => {
    expect(assistantService.isProductCatalogRequest('Quero produtos para carro')).toBe(true);
    expect(assistantService.isProductCatalogRequest('Crie uma ideia para organizar o carro')).toBe(true);
    expect(assistantService.isProductCatalogRequest('Qual é a capital da França?')).toBe(false);
  });

  it('lists only productions scoped to the creator resolved from the JWT', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(creatorContentRepo.listCreatorContent).mockResolvedValue([]);
    await creatorContentService.getCreatorContent(creatorA.user_id);
    expect(creatorContentRepo.listCreatorContent).toHaveBeenCalledWith(creatorA.id);
  });

  it('defines the requested rate limits', () => {
    expect(RATE_LIMITS.AUTH_GET.max).toBe(100);
    expect(RATE_LIMITS.AUTH_WRITE.max).toBe(30);
    expect(RATE_LIMITS.ADMIN.max).toBe(60);
  });

  it('has RLS enabled and policies in the canonical migration', () => {
    const migration = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/001_initial_schema.sql'), 'utf8');
    expect(migration).toContain('ALTER TABLE creators ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE creator_content ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('creators_select_own');
    expect(migration).toContain('creator_content_select_own');
  });

  it('keeps the service role key out of frontend source and redacts sensitive logs', () => {
    const frontend = fs.readFileSync(path.resolve(process.cwd(), '../frontend/legacy-static/app.js'), 'utf8');
    const logger = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/logger.ts'), 'utf8');
    expect(frontend).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(logger).toContain('body.service_role');
    expect(logger).toContain('body.password');
    expect(logger).toContain('req.headers.authorization');
  });
});
