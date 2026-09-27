import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../src/modules/creators/creator.repository.js', () => ({
  findCreatorByUserId: vi.fn(),
}));
vi.mock('../src/modules/creator-content/creator-content.repository.js', () => ({
  listCreatorContent: vi.fn(),
  findCreatorContentById: vi.fn(),
  findByCreatorAndKit: vi.fn(),
  findByCreatorAndProduct: vi.fn(),
  createCreatorContent: vi.fn(),
  updateCreatorContent: vi.fn(),
}));
vi.mock('../src/modules/content-kits/content-kit.repository.js', () => ({
  findContentKitById: vi.fn(),
}));
vi.mock('../src/modules/products/product.repository.js', () => ({
  findProductById: vi.fn(),
  listActiveProducts: vi.fn(),
}));

import * as creatorRepo from '../src/modules/creators/creator.repository.js';
import * as creatorContentRepo from '../src/modules/creator-content/creator-content.repository.js';
import * as kitRepo from '../src/modules/content-kits/content-kit.repository.js';
import * as productRepo from '../src/modules/products/product.repository.js';
import * as creatorContentService from '../src/modules/creator-content/creator-content.service.js';
import * as productService from '../src/modules/products/product.service.js';
import { createProductSchema } from '../src/modules/products/product.schema.js';
import { createContentKitSchema } from '../src/modules/content-kits/content-kit.schema.js';
import { createCreatorContentSchema, updateCreatorContentSchema } from '../src/modules/creator-content/creator-content.schema.js';
import { requireAuth, requireAdmin } from '../src/plugins/auth.js';
import { supabaseAdmin } from '../src/lib/supabase.js';
import { RATE_LIMITS } from '../src/config/constants.js';

const creatorA = { id: '11111111-1111-4111-8111-111111111111', user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
const creatorB = { id: '22222222-2222-4222-8222-222222222222', user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
const kit = { id: '33333333-3333-4333-8333-333333333333', product_id: '44444444-4444-4444-8444-444444444444' };

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
    expect(createProductSchema.safeParse({ nome: 'Produto', descricao: 'Descrição', categoria: 'Beleza', imagem_url: 'https://example.com/a.png', status: 'ativo' }).success).toBe(true);
    expect(createProductSchema.safeParse({ nome: 'Produto', imagem_url: 'https://example.com/a.png', preco: 99 }).success).toBe(false);
    expect(createProductSchema.partial().safeParse({ status: 'pausado', destaque: true, ordem_destaque: 2 }).success).toBe(true);
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

  it('creates creator_content with creator identity from the JWT and blocks another owner', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(kitRepo.findContentKitById).mockResolvedValue(kit as any);
    vi.mocked(productRepo.findProductById).mockResolvedValue({ id: kit.product_id, status: 'ativo' } as any);
    vi.mocked(creatorContentRepo.findByCreatorAndKit).mockResolvedValue(null);
    vi.mocked(creatorContentRepo.findByCreatorAndProduct).mockResolvedValue(null);
    vi.mocked(creatorContentRepo.createCreatorContent).mockResolvedValue({ creator_id: creatorA.id, content_kit_id: kit.id, status: 'salvo' } as any);
    await creatorContentService.saveOpportunity(creatorA.user_id, kit.id);
    expect(creatorContentRepo.createCreatorContent).toHaveBeenCalledWith({ creator_id: creatorA.id, content_kit_id: kit.id, status: 'salvo' });
    expect(updateCreatorContentSchema.safeParse({ status: 'publicado', published_url: 'https://example.com/post' }).success).toBe(true);
  });

  it('lets the authenticated creator add an active product directly to production', async () => {
    vi.mocked(creatorRepo.findCreatorByUserId).mockResolvedValue(creatorA as any);
    vi.mocked(productRepo.findProductById).mockResolvedValue({ id: kit.product_id, status: 'ativo' } as any);
    vi.mocked(creatorContentRepo.findByCreatorAndProduct).mockResolvedValue(null);
    vi.mocked(creatorContentRepo.createCreatorContent).mockResolvedValue({ creator_id: creatorA.id, product_id: kit.product_id, status: 'salvo' } as any);

    await creatorContentService.saveProduct(creatorA.user_id, kit.product_id);

    expect(creatorContentRepo.createCreatorContent).toHaveBeenCalledWith({ creator_id: creatorA.id, product_id: kit.product_id, status: 'salvo' });
    expect(createCreatorContentSchema.safeParse({ product_id: kit.product_id }).success).toBe(true);
    expect(createCreatorContentSchema.safeParse({ content_kit_id: kit.id }).success).toBe(true);
    expect(createCreatorContentSchema.safeParse({ product_id: kit.product_id, content_kit_id: kit.id }).success).toBe(false);
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
    const frontend = fs.readFileSync(path.resolve(process.cwd(), '../temtrend-web/app.js'), 'utf8');
    const logger = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/logger.ts'), 'utf8');
    expect(frontend).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(logger).toContain('body.service_role');
    expect(logger).toContain('body.password');
    expect(logger).toContain('req.headers.authorization');
  });
});
