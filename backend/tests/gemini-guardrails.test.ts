import { describe, expect, it } from 'vitest';
import { parseAndConstrainDecision } from '../src/modules/assistant/gemini.service.js';
import {
  isContentKitNovel,
  isProductNovel,
  missingStrategySections,
  parseGeneratedPackage,
  ROTEIRO_SKELETON_INSTRUCTIONS,
} from '../src/modules/assistant/gemini-generation.service.js';

describe('Gemini assistant guardrails', () => {
  it('keeps only product IDs present in the server catalog', () => {
    const decision = parseAndConstrainDecision(JSON.stringify({
      in_scope: true,
      intent_summary: 'produtos fitness',
      search_terms: ['fitness'],
      selected_product_ids: ['catalog-product', 'invented-product'],
    }), new Set(['catalog-product']));

    expect(decision.selected_product_ids).toEqual(['catalog-product']);
  });

  it('removes every product when the request is outside TemTrend scope', () => {
    const decision = parseAndConstrainDecision(JSON.stringify({
      in_scope: false,
      intent_summary: 'assunto geral',
      search_terms: [],
      selected_product_ids: ['catalog-product'],
    }), new Set(['catalog-product']));

    expect(decision.selected_product_ids).toEqual([]);
    expect(decision).not.toHaveProperty('should_create_product');
  });

  it('keeps motivos only for catalog products and truncates long ones', () => {
    const longMotivo = 'x'.repeat(200);
    const decision = parseAndConstrainDecision(JSON.stringify({
      in_scope: true,
      intent_summary: 'produtos fitness',
      search_terms: ['fitness'],
      selected_product_ids: ['catalog-product'],
      motivos: [
        { product_id: 'catalog-product', motivo: 'Barato e fácil de demonstrar em vídeo' },
        { product_id: 'invented-product', motivo: 'Produto inventado com motivo inventado' },
        { product_id: 'long-product', motivo: longMotivo },
      ],
    }), new Set(['catalog-product', 'long-product']));

    expect(decision.motivos['catalog-product']).toBe('Barato e fácil de demonstrar em vídeo');
    expect(decision.motivos).not.toHaveProperty('invented-product');
    expect(decision.motivos['long-product'].length).toBeLessThanOrEqual(140);
  });

  it('detects which strategy sections are missing from a roteiro', () => {
    expect(missingStrategySections('3 VARIAÇÕES DE HOOK, VERSÃO SEM SEGUIDORES, DICA DE PUBLICAÇÃO, VARIAÇÕES DE ROTEIRO')).toEqual([]);
    expect(missingStrategySections('3 VARIAÇÕES DE HOOK e nada mais')).toEqual([
      'versao sem seguidores',
      'dica de publicacao',
      'variacoes de roteiro',
    ]);
    expect(missingStrategySections(null)).toHaveLength(4);
  });

  it('accepts natural phrasing of the required sections', () => {
    expect(missingStrategySections('hooks alternativos, faceless, quando publicar, roteiros alternativos')).toEqual([]);
    expect(missingStrategySections('um roteiro curto e direto')).toHaveLength(4);
  });

  it('skeleton teaches the exact required titles', () => {
    const missing = missingStrategySections(ROTEIRO_SKELETON_INSTRUCTIONS);
    expect(missing).toEqual([]);
  });

  it('accepts decisions without motivos', () => {
    const decision = parseAndConstrainDecision(JSON.stringify({
      in_scope: true,
      intent_summary: 'produtos fitness',
      search_terms: ['fitness'],
      selected_product_ids: ['catalog-product'],
    }), new Set(['catalog-product']));

    expect(decision.motivos).toEqual({});
  });

  it('rejects free-form or structurally invalid model output', () => {
    expect(() => parseAndConstrainDecision('Posso responder qualquer coisa.', new Set()))
      .toThrow();
  });

  it('validates a complete generated product and normalizes hashtags', () => {
    const generated = parseGeneratedPackage(JSON.stringify({
      product: {
        nome: 'Organizador Modular de Gavetas',
        descricao: 'Conjunto ajustável para separar peças pequenas e manter gavetas organizadas.',
        categoria: 'Casa e organização',
      },
      content_kit: {
        titulo: 'Antes e depois da gaveta',
        descricao: 'Demonstração rápida da transformação de uma gaveta desorganizada.',
        formato: 'Antes e depois',
        plataforma: 'TikTok e Reels',
        nivel_dificuldade: 'Fácil',
        hook: 'Se sua gaveta nunca fica organizada, veja isso.',
        roteiro: 'ROTEIRO PRINCIPAL: mostre a gaveta bagunçada, instale os divisores e finalize com o resultado.\n3 VARIAÇÕES DE HOOK: curiosidade, identificação e resultado.\nVERSÃO SEM SEGUIDORES: grave faceless.\nDICA DE PUBLICAÇÃO: teste à noite.\n3–5 VARIAÇÕES DE ROTEIRO: antes e depois, teste e review.',
        cenas: [
          { numero: 1, tempo: '0–3s', visual: 'Gaveta bagunçada', fala: 'Olha como estava antes.', acao_edicao: 'Corte rápido' },
          { numero: 2, tempo: '3–7s', visual: 'Detalhe da bagunça', fala: 'Nada ficava no lugar.', acao_edicao: 'Zoom suave' },
          { numero: 3, tempo: '7–18s', visual: 'Instalação dos divisores', fala: 'É só ajustar e encaixar.', acao_edicao: 'Timelapse' },
          { numero: 4, tempo: '18–25s', visual: 'Resultado final', fala: 'Agora cada item tem seu lugar.', acao_edicao: 'Antes e depois' },
          { numero: 5, tempo: '25–30s', visual: 'Gaveta organizada', fala: 'Você usaria isso?', acao_edicao: 'Texto na tela' },
        ],
        copy: 'Uma mudança simples que deixa a rotina muito mais organizada.',
        cta: 'Clique no link da bio para conferir.',
        hashtags: ['organizacao', '#Casa Organizada', '#achadinhos', '#publi', '#tiktokshop'],
        audio_sugerido: 'Áudio leve em tendência, volume baixo.',
        duracao_seg: 25,
      },
    }));

    expect(generated.content_kit.hashtags).toEqual(['#organizacao', '#CasaOrganizada', '#achadinhos', '#publi', '#tiktokshop']);
    expect(generated.content_kit.cta).not.toMatch(/link|bio/i);
    expect(generated.content_kit.cenas).toHaveLength(5);
  });

  it('rejects products and content kits that repeat previous work', () => {
    const product = {
      nome: 'Organizador Modular de Gavetas',
      descricao: 'Conjunto ajustável para separar peças pequenas e organizar gavetas.',
      categoria: 'Casa',
    };
    const kit = {
      titulo: 'Antes e depois da gaveta',
      descricao: 'Transforme uma gaveta desorganizada.',
      formato: 'Antes e depois',
      plataforma: 'TikTok',
      nivel_dificuldade: 'Fácil',
      hook: 'Se sua gaveta nunca fica organizada, veja isso.',
      roteiro: 'Mostre a gaveta bagunçada, instale os divisores e revele o resultado final organizado com uma demonstração visual completa.',
      cenas: [
        { numero: 1, tempo: '0–3s', visual: 'Antes', fala: 'Veja essa bagunça.', acao_edicao: 'Corte rápido' },
        { numero: 2, tempo: '3–7s', visual: 'Problema', fala: 'Nada fica no lugar.', acao_edicao: 'Zoom' },
        { numero: 3, tempo: '7–18s', visual: 'Instalação', fala: 'Encaixe os divisores.', acao_edicao: 'Timelapse' },
        { numero: 4, tempo: '18–25s', visual: 'Depois', fala: 'Tudo em seu lugar.', acao_edicao: 'Comparação' },
        { numero: 5, tempo: '25–30s', visual: 'Final', fala: 'Você usaria?', acao_edicao: 'Texto' },
      ],
      copy: 'Uma transformação simples para organizar a rotina.',
      cta: 'Confira como funciona.',
      hashtags: ['#organizacao', '#casa', '#achadinhos', '#publi', '#tiktokshop'],
      audio_sugerido: 'Áudio leve em tendência.',
      duracao_seg: 25,
    };

    expect(isProductNovel(product, [product])).toBe(false);
    expect(isContentKitNovel(kit, [kit])).toBe(false);
    expect(isProductNovel({
      nome: 'Luminária de Leitura Vestível',
      descricao: 'Luz flexível presa ao pescoço para leitura noturna sem ocupar as mãos.',
      categoria: 'Iluminação',
    }, [product])).toBe(true);
  });
});
