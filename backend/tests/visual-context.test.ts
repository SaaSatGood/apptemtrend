import { describe, expect, it } from 'vitest';
import { parseVisualContext } from '../src/modules/assistant/visual-context.service.js';

describe('referência visual', () => {
  it('aceita uma descrição longa do provedor sem perder o resultado útil', () => {
    const description = 'Produto de organização para cozinha e casa. '.repeat(12);
    const result = parseVisualContext(JSON.stringify({
      description,
      search_terms: Array.from({ length: 10 }, (_, index) => `organizador doméstico ${index}`),
    }));

    expect(result.description.length).toBeLessThanOrEqual(280);
    expect(result.description.endsWith(' ')).toBe(false);
    expect(result.search_terms).toHaveLength(8);
  });

  it('rejeita uma resposta sem descrição', () => {
    expect(() => parseVisualContext('{"search_terms":["cozinha"]}')).toThrow();
  });
});
