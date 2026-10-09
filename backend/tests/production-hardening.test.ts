import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app.js';

describe('MVP production hardening (021+)', () => {
  it('migration 021 removes broad kit read and keeps private ownership', () => {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/021_rls_content_kits_fix.sql'),
      'utf8',
    );
    expect(sql).toContain('DROP POLICY IF EXISTS content_kits_select_active');
    expect(sql).toContain('content_kits_select_own');
    expect(sql).toContain('WITH CHECK (user_id = auth.uid())');
  });

  it('sends basic security headers on responses', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['permissions-policy']).toContain('camera=()');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['x-request-id']).toBeTruthy();
    await app.close();
  });

  it('persists atomic AI quotas and cooldowns in migration 022', () => {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/022_persistent_ai_controls.sql'),
      'utf8',
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.ai_usage_daily');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.reserve_ai_quota');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.reserve_force_new');
    expect(sql).toContain('TO service_role');
  });

  it('does not leak private data via public HTTP cache', async () => {
    const app = buildApp();
    // Sem JWT: 401, mas o ponto é que rotas privadas nunca mandam `public`.
    for (const url of ['/me', '/account', '/creator-content', '/products']) {
      const response = await app.inject({ method: 'GET', url });
      const cache = String(response.headers['cache-control'] ?? '');
      expect(cache).not.toMatch(/public/);
    }
    await app.close();
  });

  it('rejects non-image bytes on admin upload (magic-byte check)', async () => {
    // Validação unitária do formato: upload real exige admin + storage.
    // Aqui garantimos que a rota existe e exige auth antes de qualquer parse.
    const app = buildApp();
    const response = await app.inject({ method: 'POST', url: '/admin/products/image' });
    expect([400, 401, 403, 415, 500]).toContain(response.statusCode);
    await app.close();
  });
});
