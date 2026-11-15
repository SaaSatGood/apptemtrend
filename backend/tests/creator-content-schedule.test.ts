import { describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../src/lib/supabase.js', () => ({ supabaseAdmin: { from } }));

import { findCreatorContentById, updateCreatorContent } from '../src/modules/creator-content/creator-content.repository.js';

describe('agenda compatível com banco anterior à migration', () => {
  it('salva, lista e remove a data sem expor a marca nas anotações', async () => {
    const row = {
      id: 'content-1', creator_id: 'creator-1', product_id: 'product-1', content_kit_id: null,
      status: 'salvo', notas: 'Minha ideia', published_url: null, criado_em: '', atualizado_em: '',
    };
    from.mockImplementation(() => ({
      select(columns: string) {
        return {
          eq() {
            return {
              maybeSingle: async () => columns.includes('scheduled_for')
                ? { data: null, error: { code: '42703' } }
                : { data: { notas: row.notas }, error: null },
              single: async () => ({ data: { ...row }, error: null }),
            };
          },
        };
      },
      update(changes: Record<string, unknown>) {
        return {
          eq() {
            return {
              select() {
                return {
                  single: async () => {
                    if ('scheduled_for' in changes) return { data: null, error: { code: '42703' } };
                    Object.assign(row, changes);
                    return { data: { ...row }, error: null };
                  },
                };
              },
            };
          },
        };
      },
    }));

    const scheduled = await updateCreatorContent(row.id, { scheduled_for: '2026-10-26' });
    expect(scheduled).toMatchObject({ notas: 'Minha ideia', scheduled_for: '2026-10-26' });
    expect(row.notas).toContain('[temtrend:scheduled_for=2026-10-26]');
    expect(await findCreatorContentById(row.id)).toMatchObject({ notas: 'Minha ideia', scheduled_for: '2026-10-26' });

    const removed = await updateCreatorContent(row.id, { scheduled_for: null });
    expect(removed).toMatchObject({ notas: 'Minha ideia', scheduled_for: null });
    expect(row.notas).toBe('Minha ideia');
  });
});
