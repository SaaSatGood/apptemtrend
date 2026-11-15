import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const frontend = path.resolve(process.cwd(), '../frontend');
const read = (...p: string[]) => fs.readFileSync(path.join(frontend, ...p), 'utf8');
const component = (name: string) => read('components/platform', `${name}.tsx`);

describe('ux polish', () => {
  it('navegação possui indicação de ativa', () => {
    const sidebar = component('AppSidebar');
    expect(sidebar).toContain('aria-current');
    expect(sidebar).toContain('usePathname');
  });

  it('cards têm ação principal Ver produto e secundária Salvar', () => {
    const productKit = component('ProductKit');
    expect(productKit).toContain('Ver produto');
    expect(productKit).toContain('save-product');
  });

  it('modal de briefing tem chips selecionáveis', () => {
    const dialog = component('ContentKitDialog');
    expect(dialog).toContain('briefing-suggestions');
    expect(dialog).toContain('aria-pressed');
    expect(read('styles/app-dashboard.css')).toContain('.briefing-suggestions button.selected');
  });

  it('kit possui copiar roteiro além de hook/legenda/hashtags', () => {
    const productKit = component('ProductKit');
    // Ids com prefixo: dois documentos de roteiro na mesma página não duplicam ids.
    expect(productKit).toContain('idPrefix = "kit"');
    for (const id of ['copy-hook', 'copy-roteiro', 'copy-copy', 'copy-hashtags', 'copy-scenes']) {
      expect(productKit).toContain(`partId("${id}")`);
    }
  });

  it('ação principal do kit avança a produção', () => {
    const wizard = component('RecordingWizard');
    // O rótulo vem do estado real da produção (KitDetail), nunca é fixo no CTA.
    expect(wizard).toContain('readyLabel');
    expect(wizard).toMatch(/Começar a gravar|Próxima cena|Próxima etapa/);
    expect(component('KitDetail')).toContain('onReady={continueProduction}');
  });

  it('exclusão usa modal de confirmação, não confirm()', () => {
    const account = component('Account');
    expect(account).toContain('Excluir sua conta?');
    expect(account).toContain('<Modal');
    expect(account).not.toContain('window.confirm');
    expect(component('Modal')).toContain('aria-modal="true"');
  });

  it('empty state de busca orienta com CTA', () => {
    const production = component('Production');
    expect(production).toContain('Nenhum produto encontrado.');
    expect(production).toContain('Ver todos');
  });

  it('dialog de kit trata códigos da IA', () => {
    const dialog = component('ContentKitDialog');
    expect(dialog).toContain('AI_UNAVAILABLE');
    expect(dialog).toContain('SERVICE_UNAVAILABLE');
  });

  it('produção mostra status e próxima ação', () => {
    const contents = component('ContentsView');
    for (const status of ['salvo', 'em_producao', 'gravado', 'publicado']) {
      expect(contents).toContain(status);
    }
    expect(component('Production')).toContain('loadProductions');
    expect(component('Production')).toContain('publicado');
  });

  it('toast não estoura no mobile', () => {
    expect(read('styles/styles.css')).toContain('.toast{left:18px');
  });
});
