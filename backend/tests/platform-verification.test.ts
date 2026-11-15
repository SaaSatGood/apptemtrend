import { describe, expect, it, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import { assistantProductSearchSchema } from '../src/modules/assistant/assistant.schema.js';
import { onboardingSchema } from '../src/modules/creators/creator.schema.js';
import { creatorPreferencesBriefing } from '../src/modules/creators/creator.service.js';
import { createCreatorContentSchema, updateCreatorContentSchema } from '../src/modules/creator-content/creator-content.schema.js';
import { createProductSchema, catalogQuerySchema } from '../src/modules/products/product.schema.js';
import { RATE_LIMITS, UPLOAD } from '../src/config/constants.js';

const PRIVATE_ENDPOINTS: Array<{ method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; url: string; payload?: unknown }> = [
  { method: 'GET', url: '/me' },
  { method: 'POST', url: '/creators/onboarding', payload: {} },
  { method: 'POST', url: '/assistant/products', payload: { message: 'Quero vender algo' } },
  { method: 'GET', url: '/products' },
  { method: 'GET', url: '/products/catalog' },
  { method: 'GET', url: '/products/categories' },
  { method: 'GET', url: '/products/11111111-1111-4111-8111-111111111111' },
  { method: 'POST', url: '/products/11111111-1111-4111-8111-111111111111/content-kit', payload: {} },
  { method: 'GET', url: '/creator-content' },
  { method: 'GET', url: '/creator-content/11111111-1111-4111-8111-111111111111' },
  { method: 'POST', url: '/creator-content', payload: { product_id: '11111111-1111-4111-8111-111111111111' } },
  { method: 'PATCH', url: '/creator-content/11111111-1111-4111-8111-111111111111', payload: { status: 'gravado' } },
  { method: 'GET', url: '/account' },
  { method: 'PATCH', url: '/account/profile', payload: { nome: 'Teste' } },
  { method: 'DELETE', url: '/account' },
  { method: 'GET', url: '/admin/dashboard' },
  { method: 'GET', url: '/admin/ai-usage' },
  { method: 'GET', url: '/admin/creators' },
  { method: 'GET', url: '/admin/products' },
];

describe('platform verification', () => {
  it('todas as rotas privadas exigem auth', async () => {
    const app = buildApp();
    for (const route of PRIVATE_ENDPOINTS) {
      const res = await app.inject({ method: route.method, url: route.url, payload: route.payload as never });
      expect(res.statusCode, route.url).toBe(401);
      expect(res.json().error.code, route.url).toBe('UNAUTHORIZED');
    }
    await app.close();
  });

  it('valida assistant input 3-500 e uuids', () => {
    expect(assistantProductSearchSchema.safeParse({ message: 'ab' }).success).toBe(false);
    expect(assistantProductSearchSchema.safeParse({ message: 'abc' }).success).toBe(true);
    expect(assistantProductSearchSchema.safeParse({ message: 'x'.repeat(501) }).success).toBe(false);
    expect(assistantProductSearchSchema.safeParse({ message: 'ok vender algo', product_ids: ['nao-uuid'] }).success).toBe(false);
  });

  it('valida onboarding single/multi e bloqueia inválido', () => {
    expect(onboardingSchema.safeParse({ objetivo: 'invalido', estilos_conteudo: [], temas_interesse: [] }).success).toBe(false);
    expect(onboardingSchema.safeParse({ objetivo: 'comecar_vender', estilos_conteudo: ['Reviews'], temas_interesse: ['Casa'] }).success).toBe(true);
  });

  it('valida creator-content e publicação TikTok', () => {
    expect(createCreatorContentSchema.safeParse({}).success).toBe(false);
    expect(updateCreatorContentSchema.safeParse({ status: 'cancelado' }).success).toBe(false);
    expect(updateCreatorContentSchema.safeParse({ status: 'publicado', published_url: 'https://example.com/x' }).success).toBe(false);
    expect(updateCreatorContentSchema.safeParse({ status: 'publicado', published_url: 'https://www.tiktok.com/@a/video/1' }).success).toBe(true);
    expect(updateCreatorContentSchema.safeParse({}).success).toBe(false);
  });

  it('valida produto admin sem vazar 500', () => {
    expect(createProductSchema.safeParse({ nome: '', imagem_url: 'https://example.com/a.png' }).success).toBe(false);
    expect(createProductSchema.safeParse({ nome: 'P', imagem_url: 'notaurl' }).success).toBe(false);
    expect(createProductSchema.safeParse({ nome: 'P', imagem_url: 'https://example.com/a.png', preco_min_brl: 5, preco_max_brl: 1 }).success).toBe(false);
  });

  it('valida filtros da vitrine de produtos', () => {
    const defaults = catalogQuerySchema.parse({});
    expect(defaults).toMatchObject({ sort: 'relevancia', page: 1, limit: 24 });
    expect(catalogQuerySchema.safeParse({ sort: 'aleatorio' }).success).toBe(false);
    expect(catalogQuerySchema.safeParse({ limit: 100 }).success).toBe(false);
    expect(catalogQuerySchema.safeParse({ comissao_min: 150 }).success).toBe(false);
    expect(catalogQuerySchema.safeParse({ q: 'x'.repeat(121) }).success).toBe(false);
    const filtered = catalogQuerySchema.parse({
      q: 'organizador', categoria: 'Casa', sort: 'vendas', preco_max: '80', comissao_min: '10', page: '2',
    });
    expect(filtered).toMatchObject({ q: 'organizador', categoria: 'Casa', sort: 'vendas', preco_max: 80, comissao_min: 10, page: 2 });
  });

  it('rate-limits de IA e upload estão configurados', () => {
    expect(RATE_LIMITS.ASSISTANT_SEARCH.max).toBeLessThanOrEqual(12);
    expect(RATE_LIMITS.CONTENT_KIT_GENERATE.max).toBeLessThanOrEqual(12);
    expect(UPLOAD.MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
    expect(UPLOAD.ALLOWED_MIME_TYPES).toContain('image/png');
  });

  it('frontend Next expõe os fluxos e as páginas legais', () => {
    const web = path.resolve(process.cwd(), '../frontend');
    const required = [
      'app/page.tsx',
      'app/planos/page.tsx',
      'app/termos/page.tsx',
      'app/privacidade/page.tsx',
      'app/reembolso/page.tsx',
      'components/platform/Auth.tsx',
      'components/platform/Assistant.tsx',
      'components/platform/Account.tsx',
      'components/platform/store.tsx',
      'components/PublicFooter.tsx',
    ];
    for (const file of required) {
      expect(fs.existsSync(path.join(web, file)), file).toBe(true);
    }
    const auth = fs.readFileSync(path.join(web, 'components/platform/Auth.tsx'), 'utf8');
    expect(auth).toContain('signInWithPassword');
    expect(auth).toContain('/auth/signup');
    expect(auth).toContain('/auth/verify-code');
    const footer = fs.readFileSync(path.join(web, 'components/PublicFooter.tsx'), 'utf8');
    expect(footer).toContain('/termos');
    expect(footer).toContain('/privacidade');
    expect(footer).toContain('/reembolso');
    const source = [
      'components/platform/Auth.tsx',
      'components/platform/store.tsx',
      'lib/supabase.ts',
    ].map((file) => fs.readFileSync(path.join(web, file), 'utf8')).join('\n');
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(source).not.toContain('GEMINI_API_KEY');
  });

  it('migrations críticas existem', () => {
    const dir = path.resolve(process.cwd(), 'supabase/migrations');
    for (const m of ['001_initial_schema.sql', '019_performance_indexes.sql', '020_rls_hardening.sql']) {
      expect(fs.existsSync(path.join(dir, m)), m).toBe(true);
    }
    const rls = fs.readFileSync(path.join(dir, '020_rls_hardening.sql'), 'utf8');
    expect(rls).toContain('TO authenticated');
  });

  it('briefing das preferências usa temas, nicho e formatos sem inventar dados', () => {
    const briefing = creatorPreferencesBriefing({
      objetivo: 'comecar_vender',
      temas_interesse: ['Casa', 'Outros: festas infantis'],
      estilos_conteudo: ['Unboxing', 'Outro: react em dupla'],
    } as never);
    expect(briefing).toContain('objetivo: começar a vender');
    expect(briefing).toContain('temas: Casa, festas infantis');
    expect(briefing).toContain('formatos preferidos: Unboxing, react em dupla');
    expect(briefing).toContain('não invente dados do produto');
    expect(creatorPreferencesBriefing({ objetivo: null, temas_interesse: [], estilos_conteudo: [] } as never)).toBeUndefined();
  });

  it('erros nunca vazam stack ou secrets', async () => {
    const app = buildApp();
    app.get('/__test/secret-boom', async () => {
      throw new Error('gemini key sk-123 stack trace supabase secret');
    });
    const res = await app.inject({ method: 'GET', url: '/__test/secret-boom' });
    expect(res.statusCode).toBe(500);
    const body = JSON.stringify(res.json());
    expect(body).not.toMatch(/sk-123|stack trace|gemini/i);
    expect(res.json().error.code).toBe('INTERNAL_ERROR');
    await app.close();
  });
});
