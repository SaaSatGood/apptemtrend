import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../src/modules/products/product.repository.js', () => ({
  findProductById: vi.fn(),
  findProductByExternalId: vi.fn(),
  listActiveProducts: vi.fn(),
  listAllProducts: vi.fn(),
  createProduct: vi.fn(),
  createProductWithContentKit: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock('../src/modules/content-kits/content-kit.repository.js', () => ({
  findContentKitById: vi.fn(),
  listContentKitsByProductId: vi.fn(),
  createContentKit: vi.fn(),
  updateContentKit: vi.fn(),
}));

vi.mock('../src/modules/assistant/ai.service.js', () => ({
  AIService: {
    isAvailable: vi.fn(() => false),
    interpretIntent: vi.fn(async () => null),
    refineProductSearch: vi.fn(async () => null),
    generateContentKit: vi.fn(async () => null),
  },
}));

import * as productRepo from '../src/modules/products/product.repository.js';
import * as kitRepo from '../src/modules/content-kits/content-kit.repository.js';
import { AIService } from '../src/modules/assistant/ai.service.js';
import {
  findProductsForMessage,
  isGreetingOnly,
  isDiscoveryRequest,
  isProductCatalogRequest,
} from '../src/modules/assistant/assistant.service.js';
import { createFreshContentKit, ensureContentKit } from '../src/modules/products/product.service.js';
import { buildApp } from '../src/app.js';

const catalogFacts = {
  produto_externo_id: null,
  loja_nome: null,
  preco_texto: null,
  preco_min_brl: null,
  preco_max_brl: null,
  pais_regiao: null,
  comissao_percentual: null,
  unidades_vendidas_periodo: null,
  crescimento_vendas_percentual: null,
  unidades_vendidas_total: null,
  receita_periodo_brl: null,
  receita_total_brl: null,
  data_estimada_upload: null,
  unidades_vendidas_total_loja: null,
  fastmoss_produto_url: null,
  tiktok_shop_url: null,
  fastmoss_loja_url: null,
  status_origem: null,
  fonte_dados: null,
  ranking_origem: null,
};

const catalog = [
  {
    ...catalogFacts,
    id: '11111111-1111-4111-8111-111111111111',
    nome: 'Faixa elástica',
    descricao: 'Treino em casa',
    categoria: 'Fitness',
    imagem_url: 'https://example.com/faixa-elastica.jpg',
    status: 'ativo',
    destaque: false,
    ordem_destaque: 0,
    criado_por: null,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
  },
  {
    ...catalogFacts,
    id: '22222222-2222-4222-8222-222222222222',
    nome: 'Organizador de gavetas',
    descricao: 'Organização simples para a casa',
    categoria: 'Casa',
    imagem_url: 'https://example.com/organizador.jpg',
    status: 'ativo',
    destaque: true,
    ordem_destaque: 1,
    criado_por: null,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
  },
];

const contentKit = {
  titulo: 'Antes e depois da gaveta',
  descricao: 'Demonstração rápida da transformação de uma gaveta desorganizada.',
  formato: 'Antes e depois',
  plataforma: 'TikTok e Reels',
  nivel_dificuldade: 'Fácil',
  hook: 'Se sua gaveta nunca fica organizada, veja isso.',
  roteiro: 'ROTEIRO PRINCIPAL: mostre a gaveta bagunçada, instale os divisores e finalize com o resultado.\n3 VARIAÇÕES DE HOOK: curiosidade, identificação e resultado.\nVERSÃO SEM SEGUIDORES: grave faceless com prova visual.\nDICA DE PUBLICAÇÃO: teste à noite com áudio leve.\n3–5 VARIAÇÕES DE ROTEIRO: antes e depois, teste e review.',
  cenas: [
    { numero: 1, tempo: '0–3s', visual: 'Gaveta bagunçada', fala: 'Olha como estava antes.', acao_edicao: 'Corte rápido' },
    { numero: 2, tempo: '3–7s', visual: 'Detalhe da bagunça', fala: 'Nada ficava no lugar.', acao_edicao: 'Zoom suave' },
    { numero: 3, tempo: '7–18s', visual: 'Instalação dos divisores', fala: 'É só ajustar e encaixar.', acao_edicao: 'Timelapse' },
    { numero: 4, tempo: '18–25s', visual: 'Resultado final', fala: 'Agora cada item tem seu lugar.', acao_edicao: 'Antes e depois' },
    { numero: 5, tempo: '25–30s', visual: 'Gaveta organizada', fala: 'Você usaria isso?', acao_edicao: 'Texto na tela' },
  ],
  copy: 'Uma mudança simples que deixa a rotina muito mais organizada.',
  cta: 'Confira este produto e veja como ele pode facilitar sua rotina.',
  hashtags: ['#organizacao', '#achadinhos', '#casaorganizada', '#publi', '#tiktokshop'],
  audio_sugerido: 'Áudio leve em tendência, volume baixo.',
  duracao_seg: 25,
};

const brandMessages = /erro|internal|stack|trace|api|gemini|500|undefined|null|exception/i;

describe('assistant experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productRepo.listActiveProducts).mockResolvedValue(catalog);
    vi.mocked(AIService.interpretIntent).mockResolvedValue(null);
    vi.mocked(AIService.refineProductSearch).mockResolvedValue(null);
  });

  it('answers with real catalog products and a brand message', async () => {
    const result = await findProductsForMessage({ message: 'Quero vender produtos para academia' });

    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.message).toBe('Encontrei 1 produto para você.');
  });

  it('treats "não sei o que vender" as discovery', async () => {
    expect(isDiscoveryRequest('Não sei o que vender')).toBe(true);

    const result = await findProductsForMessage({ message: 'Não sei o que vender' });

    expect(result.products).toHaveLength(2);
    expect(result.message).toBe('Separei algumas opções para você começar.');
  });

  it('keeps the previous options when a refinement finds nothing new', async () => {
    const result = await findProductsForMessage({
      message: 'Quero algo fácil de demonstrar',
      product_ids: ['11111111-1111-4111-8111-111111111111'],
    });

    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.message).toBe('Não achei um produto novo com esse filtro. Mantive as opções anteriores.');
    expect(AIService.refineProductSearch).toHaveBeenCalled();
  });

  it('starts a new search when the message points to a new subject', async () => {
    const result = await findProductsForMessage({
      message: 'Quero vender produtos para academia',
      product_ids: ['22222222-2222-4222-8222-222222222222'],
    });

    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.message).toBe('Encontrei 1 produto para você.');
    expect(AIService.interpretIntent).toHaveBeenCalled();
    expect(AIService.refineProductSearch).not.toHaveBeenCalled();
  });

  it('does not recommend unrelated products when a specific search has no match', async () => {
    expect(isProductCatalogRequest('Crie um produto fácil de demonstrar para carro')).toBe(true);

    const result = await findProductsForMessage({ message: 'Crie um produto fácil de demonstrar para carro' });

    expect(result.products).toHaveLength(0);
    expect(result.products.every((product) => catalog.some((item) => item.id === product.id))).toBe(true);
    expect(result.message).not.toMatch(/criei|criado|novo produto/i);
    expect(result).not.toHaveProperty('created');
    expect(result).not.toHaveProperty('content_kit_id');
  });

  it('ignores an AI selection unrelated to the requested category', async () => {
    vi.mocked(AIService.interpretIntent).mockResolvedValue({
      in_scope: true,
      intent_summary: 'Produtos para academia',
      search_terms: [],
      selected_product_ids: [catalog[1].id],
      motivos: {},
      provider: 'gemini',
      usage: { prompt_tokens: 0, response_tokens: 0, thoughts_tokens: 0, total_tokens: 0 },
      latency_ms: 0,
    });
    const result = await findProductsForMessage({ message: 'Quero vender produtos para academia' });
    expect(result.products.map((product) => product.id)).toEqual([catalog[0].id]);
  });

  it('asks a follow-up for a greeting instead of returning random products', async () => {
    expect(isGreetingOnly('Olá!')).toBe(true);
    expect(isGreetingOnly('Olá, quero produtos para casa')).toBe(false);
    const result = await findProductsForMessage({ message: 'Olá!' });
    expect(result.products).toHaveLength(0);
    expect(result.needs_clarification).toBe(true);
    expect(result.message).toMatch(/O que você quer vender\?/);
    expect(AIService.interpretIntent).not.toHaveBeenCalled();
    expect(productRepo.listActiveProducts).not.toHaveBeenCalled();
  });

  it('asks for a niche when ease of filming cannot be verified from catalog data', async () => {
    const result = await findProductsForMessage({ message: 'Quero produtos fáceis de demonstrar em vídeo' });
    expect(result.products).toHaveLength(0);
    expect(result.needs_clarification).toBe(true);
    expect(result.message).toMatch(/O catálogo não informa/);
  });

  it('respeita um teto de preço antes de pedir sugestões à IA', async () => {
    vi.mocked(productRepo.listActiveProducts).mockResolvedValue([
      { ...catalog[0], preco_min_brl: 39.9 },
      { ...catalog[1], preco_min_brl: 89.9 },
    ]);
    const result = await findProductsForMessage({ message: 'Quero produtos com preço de até 50 reais' });
    expect(result.products.map((product) => product.id)).toEqual([catalog[0].id]);
    expect(vi.mocked(AIService.interpretIntent).mock.calls[0]?.[1]).toHaveLength(1);
  });

  it('does not persist a product even when the creator explicitly asks for one', async () => {
    const result = await findProductsForMessage({ message: 'Crie uma ideia totalmente nova para gravar vídeos' });

    expect(result.products.every((product) => catalog.some((item) => item.id === product.id))).toBe(true);
    expect(result).not.toHaveProperty('created');
    expect(productRepo.createProductWithContentKit).not.toHaveBeenCalled();
  });

  it('ignores legacy products previously created by the AI', async () => {
    vi.mocked(productRepo.listActiveProducts).mockResolvedValue([
      ...catalog,
      {
        ...catalog[0],
        id: '33333333-3333-4333-8333-333333333333',
        nome: 'Produto inventado antigo',
        imagem_url: null,
      },
    ]);

    const result = await findProductsForMessage({ message: 'Não sei o que vender' });

    expect(result.products).toHaveLength(2);
    expect(result.products.map((product) => product.id)).not.toContain('33333333-3333-4333-8333-333333333333');
  });

  it('confirms the choice when the creator says "esse aqui"', async () => {
    const single = await findProductsForMessage({
      message: 'Esse aqui.',
      product_ids: ['11111111-1111-4111-8111-111111111111'],
    });

    expect(single.products).toHaveLength(1);
    expect(single.message).toBe('Boa escolha. Esse é o produto certo para começar.');
    expect(AIService.interpretIntent).not.toHaveBeenCalled();
    expect(AIService.refineProductSearch).not.toHaveBeenCalled();

    const many = await findProductsForMessage({
      message: 'Quero esse',
      product_ids: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
    });

    expect(many.products).toHaveLength(2);
    expect(many.message).toBe('Boa escolha. Toque em Ver produto para continuar.');
  });

  it('returns a retry state when no product is relevant', async () => {
    const result = await findProductsForMessage({ message: 'Quero ajuda com meu trabalho de escola' });

    expect(result.products).toHaveLength(0);
    expect(result.message).toBe('Não encontrei um produto para essa busca. Experimente descrever de outra forma.');
  });

  it('keeps every assistant message friendly and on brand', async () => {
    const messages = [
      (await findProductsForMessage({ message: 'Quero vender produtos para academia' })).message,
      (await findProductsForMessage({ message: 'Não sei o que vender' })).message,
      (await findProductsForMessage({ message: 'Quero ajuda com meu trabalho de escola' })).message,
      (await findProductsForMessage({
        message: 'Quero algo fácil de demonstrar',
        product_ids: ['11111111-1111-4111-8111-111111111111'],
      })).message,
    ];

    for (const message of messages) {
      expect(message).not.toMatch(brandMessages);
      expect(message.length).toBeGreaterThan(10);
    }
  });

  it('retorna no máximo 5 produtos por busca', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      id: `0000000${i}-1111-4111-8111-111111111111`,
      nome: 'Produto academia fitness treino',
      descricao: 'Treino em casa academia',
      categoria: 'Fitness',
      imagem_url: 'https://example.com/a.jpg',
      status: 'ativo',
      destaque: false,
    }));
    vi.mocked(productRepo.listActiveProducts).mockResolvedValue(many as never);
    const result = await findProductsForMessage({ message: 'Quero vender produtos para academia fitness treino' });
    expect(result.products.length).toBeLessThanOrEqual(5);
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('anexa motivo real a cada produto recomendado', async () => {
    const items = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        nome: 'Fone academia treino',
        descricao: 'Fone para treino academia',
        categoria: 'Fitness',
        imagem_url: 'https://example.com/f.jpg',
        preco_min_brl: 39.9,
        comissao_percentual: 12,
        unidades_vendidas_total: 1500,
        status: 'ativo',
        destaque: false,
      },
    ];
    vi.mocked(productRepo.listActiveProducts).mockResolvedValue(items as never);
    const result = await findProductsForMessage(
      { message: 'Quero vender fone para academia treino' },
      { temas_interesse: ['Fitness'], estilos_conteudo: [] },
    );
    expect(result.products.length).toBeGreaterThan(0);
    const motivo = String(result.products[0].motivo ?? '');
    expect(motivo.length).toBeGreaterThan(0);
    expect(motivo.length).toBeLessThanOrEqual(140);
    expect(motivo).toMatch(/Fitness|39|12|1\.500|acessível|Comissão|vendidos|busca/i);
  });

  it('não inventa motivo sem dados reais', async () => {
    const items = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        nome: 'Produto academia treino',
        descricao: 'Treino academia',
        categoria: 'Fitness',
        imagem_url: 'https://example.com/g.jpg',
        preco_min_brl: null,
        comissao_percentual: null,
        unidades_vendidas_total: null,
        unidades_vendidas_periodo: null,
        status: 'ativo',
        destaque: false,
      },
    ];
    vi.mocked(productRepo.listActiveProducts).mockResolvedValue(items as never);
    const result = await findProductsForMessage({ message: 'Quero vender produto academia treino' });
    expect(result.products.length).toBeGreaterThan(0);
    expect(String(result.products[0].motivo ?? '')).toBe('Selecionado para a sua busca');
  });

  it('answers with a retry state when the catalog is empty, without spending AI calls', async () => {
    vi.mocked(productRepo.listActiveProducts).mockResolvedValue([]);

    const result = await findProductsForMessage({ message: 'Quero vender produtos para academia' });

    expect(result.products).toHaveLength(0);
    expect(result.message).not.toMatch(brandMessages);
    expect(AIService.interpretIntent).not.toHaveBeenCalled();
  });
});

describe('content kit preparation', () => {
  const product = catalog[1];
  const creatorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productRepo.findProductById).mockResolvedValue(product);
    vi.mocked(kitRepo.listContentKitsByProductId).mockResolvedValue([]);
    vi.mocked(AIService.generateContentKit).mockResolvedValue(null);
  });

  it('reuses an existing Content Kit by default', async () => {
    const previous = { id: 'kit-1', product_id: product.id, titulo: 'Kit anterior' };
    vi.mocked(kitRepo.listContentKitsByProductId).mockResolvedValue([previous] as never);

    const result = await ensureContentKit(product.id, creatorId);

    expect(result.created).toBe(false);
    expect(result.content_kit).toEqual(previous);
    expect(AIService.generateContentKit).not.toHaveBeenCalled();
    expect(kitRepo.createContentKit).not.toHaveBeenCalled();
  });

  it('creates another Content Kit only when explicitly requested', async () => {
    const previous = { id: 'kit-1', product_id: product.id, titulo: 'Kit anterior' };
    vi.mocked(kitRepo.listContentKitsByProductId).mockResolvedValue([previous] as never);
    vi.mocked(AIService.generateContentKit).mockResolvedValue({ content_kit: contentKit } as never);
    vi.mocked(kitRepo.createContentKit).mockResolvedValue({ id: 'kit-new', product_id: product.id, ...contentKit } as never);

    const result = await createFreshContentKit(product.id, creatorId);

    expect(result.created).toBe(true);
    expect(result.content_kit).toMatchObject({ id: 'kit-new' });
    expect(AIService.generateContentKit).toHaveBeenCalledWith(product, [previous], undefined, undefined);
    expect(kitRepo.createContentKit).toHaveBeenCalledOnce();
  });

  it('aplica a voz do creator e marca usou_voz no kit', async () => {
    vi.mocked(kitRepo.listContentKitsByProductId).mockResolvedValue([]);
    vi.mocked(AIService.generateContentKit).mockResolvedValue({ content_kit: contentKit } as never);
    vi.mocked(kitRepo.createContentKit).mockResolvedValue({ id: 'kit-voz', product_id: product.id, ...contentKit } as never);

    const result = await ensureContentKit(product.id, creatorId, undefined, 'falo direto e sem enrolação');

    expect(result.created).toBe(true);
    expect(AIService.generateContentKit).toHaveBeenCalledWith(product, [], undefined, 'falo direto e sem enrolação');
    expect(kitRepo.createContentKit).toHaveBeenCalledWith(product.id, contentKit, {
      creatorId,
      briefing: undefined,
      usouVoz: true,
    });
  });

  it('creates a Content Kit from real product data', async () => {
    vi.mocked(AIService.generateContentKit).mockResolvedValue({ content_kit: contentKit } as never);
    vi.mocked(kitRepo.createContentKit).mockResolvedValue({ id: 'kit-new', product_id: product.id, ...contentKit } as never);

    const result = await ensureContentKit(product.id, creatorId, 'Vídeo curto e agressivo, com 15 segundos');

    expect(result.created).toBe(true);
    expect(result.content_kit.id).toBe('kit-new');
    expect(kitRepo.createContentKit).toHaveBeenCalledWith(product.id, contentKit, {
      creatorId,
      briefing: 'Vídeo curto e agressivo, com 15 segundos',
      usouVoz: false,
    });
    expect(AIService.generateContentKit).toHaveBeenCalledWith(product, [], 'Vídeo curto e agressivo, com 15 segundos', undefined);
  });

  it('delivers a base kit when AI generation fails instead of erroring', async () => {
    vi.mocked(kitRepo.createContentKit).mockResolvedValue({ id: 'kit-base', product_id: product.id } as never);
    const result = await ensureContentKit(product.id, creatorId);
    expect(result.created).toBe(true);
    expect(result).toMatchObject({ fallback: true });
    expect(kitRepo.createContentKit).toHaveBeenCalled();
  });

  it('does not create a Content Kit for a paused product', async () => {
    vi.mocked(productRepo.findProductById).mockResolvedValue({ ...product, status: 'pausado' } as never);

    await expect(ensureContentKit(product.id, creatorId)).rejects.toMatchObject({ statusCode: 404 });
    expect(AIService.generateContentKit).not.toHaveBeenCalled();
  });
});

describe('error transparency', () => {
  it('never exposes internal error details', async () => {
    const app = buildApp();
    app.get('/__test/boom', async () => {
      throw new Error('gemini stack trace: secret detail');
    });

    const response = await app.inject({ method: 'GET', url: '/__test/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('INTERNAL_ERROR');
    expect(response.json().error.message).toBe('Não conseguimos concluir agora. Tente novamente.');
    expect(JSON.stringify(response.json())).not.toMatch(/secret|stack/i);
    await app.close();
  });

  it('keeps the assistant route behind authentication', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/assistant/products',
      payload: { message: 'Quero vender produtos para academia' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    await app.close();
  });

  it('requires authentication before preparing a Content Kit', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/products/11111111-1111-4111-8111-111111111111/content-kit',
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
