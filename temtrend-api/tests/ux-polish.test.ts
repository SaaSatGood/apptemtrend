import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const web = (...p: string[]) => path.resolve(process.cwd(), '../temtrend-web', ...p);
const read = (f: string) => fs.readFileSync(web(f), 'utf8');

describe('ux polish', () => {
  it('navegação possui indicação de ativa', () => {
    expect(read('styles.css')).toContain('.app-nav a.active');
    expect(read('app.js')).toContain('aria-current');
  });

  it('cards têm ação principal Ver produto e secundária Salvar', () => {
    const appJs = read('app.js');
    expect(appJs).toContain('primary open-product');
    expect(appJs).toContain('ghost save-product');
  });

  it('modal de briefing tem chips selecionáveis', () => {
    expect(read('app.js')).toContain("briefing-suggestions button.selected");
    expect(read('styles.css')).toContain('.briefing-suggestions button.selected');
  });

  it('kit possui copiar roteiro além de hook/legenda/hashtags', () => {
    const appJs = read('app.js');
    for (const id of ['copy-hook', 'copy-roteiro', 'copy-copy', 'copy-hashtags', 'copy-content-kit']) {
      expect(appJs).toContain(id);
    }
  });

  it('ação principal do kit é adicionar à produção', () => {
    expect(read('app.js')).toContain('Adicionar à minha produção');
  });

  it('exclusão usa modal de confirmação, não confirm()', () => {
    expect(read('app.html')).toContain('delete-account-dialog');
    expect(read('app.js')).toContain('confirm-delete-account');
    expect(read('app.js')).not.toContain('confirm(');
  });

  it('empty state de busca orienta com CTA', () => {
    expect(read('app.js')).toContain('Nenhum produto encontrado.');
  });

  it('toast não estoura no mobile', () => {
    expect(read('styles.css')).toContain('.toast{left:18px');
  });
});
