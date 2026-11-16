import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { toCsv, csvCell, productsQuerySchema, leadsQuerySchema } from '../src/modules/admin/admin.routes.js';
import { LEAD_STATUSES } from '../src/modules/admin/admin.repository.js';

const PRIVATE_ADMIN_ROUTES: Array<{ method: 'GET' | 'POST' | 'PATCH'; url: string; payload?: unknown }> = [
  { method: 'GET', url: '/admin/dashboard' },
  { method: 'GET', url: '/admin/ai-usage' },
  { method: 'GET', url: '/admin/creators' },
  { method: 'GET', url: '/admin/creators/11111111-1111-4111-8111-111111111111' },
  { method: 'GET', url: '/admin/products' },
  { method: 'GET', url: '/admin/products/categories' },
  { method: 'GET', url: '/admin/products/export' },
  { method: 'GET', url: '/admin/products/11111111-1111-4111-8111-111111111111' },
  { method: 'GET', url: '/admin/leads' },
  { method: 'PATCH', url: '/admin/leads/11111111-1111-4111-8111-111111111111/status', payload: { status: 'contatado' } },
  { method: 'GET', url: '/admin/billing/summary' },
  { method: 'GET', url: '/admin/billing/subscriptions' },
  { method: 'GET', url: '/admin/analytics/funnel' },
  { method: 'GET', url: '/admin/support/tickets' },
  { method: 'PATCH', url: '/admin/support/tickets/11111111-1111-4111-8111-111111111111', payload: { status: 'resolved' } },
];

describe('admin dashboard completion', () => {
  it('protege todas as rotas do painel com admin auth', async () => {
    const app = buildApp();
    for (const route of PRIVATE_ADMIN_ROUTES) {
      const response = await app.inject({
        method: route.method,
        url: route.url,
        payload: route.payload as never,
      });
      expect(response.statusCode, `${route.method} ${route.url}`).toBe(401);
      expect(response.json().error.code, route.url).toBe('UNAUTHORIZED');
    }
    await app.close();
  });

  it('pagina e filtra o catálogo no servidor', () => {
    const defaults = productsQuerySchema.parse({});
    expect(defaults).toMatchObject({ page: 1, limit: 30, sort: 'ranking' });

    const filtered = productsQuerySchema.parse({
      q: 'depilador',
      status: 'pausado',
      categoria: 'Beleza',
      sort: 'vendas',
      page: '3',
      limit: '50',
    });
    expect(filtered).toMatchObject({
      q: 'depilador',
      status: 'pausado',
      categoria: 'Beleza',
      sort: 'vendas',
      page: 3,
      limit: 50,
    });

    expect(productsQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    expect(productsQuerySchema.safeParse({ sort: 'aleatorio' }).success).toBe(false);
    expect(productsQuerySchema.safeParse({ status: 'arquivado' }).success).toBe(false);
    expect(productsQuerySchema.safeParse({ q: 'x'.repeat(200) }).success).toBe(false);
  });

  it('valida filtros de leads e o catálogo de status', () => {
    expect(LEAD_STATUSES).toEqual(['novo', 'contatado', 'qualificado', 'descartado']);
    const query = leadsQuerySchema.parse({ status: 'qualificado', limit: '20' });
    expect(query).toMatchObject({ status: 'qualificado', page: 1, limit: 20 });
    expect(leadsQuerySchema.safeParse({ status: 'fechado' }).success).toBe(false);
  });

  it('gera CSV escapando aspas, ponto e vírgula e quebras de linha', () => {
    expect(csvCell('Reparador "Gloss"')).toBe('"Reparador ""Gloss"""');
    const csv = toCsv(['Produto', 'Loja'], [['Kit; Depilador', 'HAOBI\nBR']]);
    expect(csv).toBe('"Produto";"Loja"\n"Kit; Depilador";"HAOBI\nBR"');
  });
});
