import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_LIMITS } from '../src/config/constants.js';

const PRODUCT = {
  id: 'p1',
  nome: 'Haltere ajustável',
  categoria: 'Fitness',
  descricao: 'Haltere com peso regulável para treino em casa',
};

async function loadService() {
  vi.resetModules();
  return import('../src/modules/assistant/opencode.service.js');
}

function chatResponse(content: string, options: { finishReason?: string; usage?: Record<string, unknown> } = {}) {
  return new Response(JSON.stringify({
    choices: [{ finish_reason: options.finishReason ?? 'stop', message: { content } }],
    usage: options.usage ?? {
      prompt_tokens: 100,
      completion_tokens: 40,
      total_tokens: 140,
      completion_tokens_details: { reasoning_tokens: 0 },
    },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

const DECISION_JSON = JSON.stringify({
  in_scope: true,
  intent_summary: 'Busca por halteres até 100 reais',
  search_terms: ['halter', 'academia'],
  selected_product_ids: ['p1'],
  motivos: [{ product_id: 'p1', motivo: 'Cabe no orçamento e é fácil de gravar' }],
});

const FULL_PRODUCT = {
  id: 'p1',
  nome: 'Organizador Modular de Gavetas',
  categoria: 'Casa e organização',
  descricao: 'Divisores ajustáveis para separar peças pequenas dentro da gaveta.',
};

function kitPackage(content: Record<string, unknown>) {
  return JSON.stringify({
    product: { nome: FULL_PRODUCT.nome, descricao: FULL_PRODUCT.descricao, categoria: FULL_PRODUCT.categoria },
    content_kit: {
      titulo: 'Organizador de gaveta',
      descricao: 'Um vídeo curto mostrando o item e o resultado.',
      formato: 'Demonstração',
      plataforma: 'TikTok',
      nivel_dificuldade: 'Fácil',
      hook: 'Olha isso de perto.',
      cenas: [0, 1, 2, 3, 4].map((index) => ({
        numero: index + 1,
        tempo: ['0-3s', '3-7s', '7-18s', '18-25s', '25-30s'][index],
        visual: 'Close',
        fala: 'Olha isso de perto.',
        acao_edicao: 'Corte seco',
      })),
      copy: 'Comenta aqui o que você achou.',
      cta: 'Confira no TikTok Shop.',
      hashtags: ['#organizacao', '#casa', '#achadinhos', '#publi', '#tiktokshop'],
      audio_sugerido: 'Áudio leve em tendência.',
      duracao_seg: 25,
      ...content,
    },
  });
}

const GENERIC_PACKAGE = kitPackage({
  roteiro: [
    'ROTEIRO PRINCIPAL: 0-3s: Olha isso de perto. | 3-7s: Veja o detalhe. | 7-18s: Aqui está em uso. | 18-25s: Este é o resultado. | 25-30s: Confira no TikTok Shop.',
    '3 VARIAÇÕES DE HOOK: 1) Olha isso. 2) Veja o detalhe. 3) Repara nisso.',
    'VERSÃO SEM SEGUIDORES: apoie o celular e grave as mãos.',
    'DICA DE PUBLICAÇÃO: 1) horário: teste 7h e 20h 2) comentário fixado: "você usaria?" 3) retenção: corte o começo.',
    '5 VARIAÇÕES DE ROTEIRO: A) Close B) Uso C) Rotina D) Detalhe E) Resultado final.',
  ].join('\n'),
});

const SPECIFIC_PACKAGE = kitPackage({
  hook: 'Olha como o divisor encaixa na gaveta.',
  roteiro: [
    'ROTEIRO PRINCIPAL: 0-3s: Olha como o divisor encaixa. | 3-7s: São peças plásticas que deslizam. | 7-18s: A mão puxa o divisor até o tamanho da gaveta. | 18-25s: O trilho trava e a gaveta fica dividida. | 25-30s: Confira o organizador no TikTok Shop.',
    '3 VARIAÇÕES DE HOOK: 1) O divisor desliza e trava. 2) Minha gaveta vivia misturada. 3) Antes tudo solto, agora separado.',
    'VERSÃO SEM SEGUIDORES: apoie o celular na bancada e grave as mãos ajustando o divisor.',
    'DICA DE PUBLICAÇÃO: 1) horário: teste 7h e 20h 2) comentário fixado: "qual gaveta você organiza primeiro?" 3) retenção: comece com o divisor já na mão.',
    '5 VARIAÇÕES DE ROTEIRO: A) Encaixe do divisor B) Ajuste de tamanho C) Gaveta de talheres D) Montagem das peças E) Antes e depois da gaveta.',
  ].join('\n'),
  cenas: [0, 1, 2, 3, 4].map((index) => ({
    numero: index + 1,
    tempo: ['0-3s', '3-7s', '7-18s', '18-25s', '25-30s'][index],
    visual: index === 0 ? 'Close no divisor plástico dentro da gaveta' : `Divisor ajustado na gaveta, cena ${index + 1}`,
    fala: index === 0 ? 'Olha como o divisor encaixa na gaveta.' : 'O divisor trava no tamanho da gaveta.',
    acao_edicao: 'Corte seco',
  })),
});

describe('OpenCode Go provider', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
    vi.stubEnv('CORS_ORIGIN', 'https://example.com');
    vi.stubEnv('FRONTEND_URL', 'https://example.com');
    vi.stubEnv('AI_QUOTA_STORE', 'memory');
    vi.stubEnv('AI_PROVIDER', 'opencode');
    vi.stubEnv('OPENCODE_API_KEY', 'oc_test_key');
    vi.stubEnv('OPENCODE_MODEL', 'deepseek-v4.1-flash');
    vi.stubEnv('OPENCODE_BASE_URL', 'https://opencode.ai/inference/go/openai/v1');
    vi.stubEnv('OPENCODE_REASONING_EFFORT', 'none');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('chama a API do Go com headers e payload esperados', async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(DECISION_JSON));
    vi.stubGlobal('fetch', fetchMock);

    const { classifyCatalogRequest } = await loadService();
    const result = await classifyCatalogRequest('halteres baratos', [PRODUCT as never], 'user-1');

    expect(result).toMatchObject({ provider: 'opencode', selected_product_ids: ['p1'] });
    expect(result?.usage).toEqual({
      prompt_tokens: 100,
      response_tokens: 40,
      thoughts_tokens: 0,
      total_tokens: 140,
    });
    expect(result?.motivos).toEqual({ p1: 'Cabe no orçamento e é fácil de gravar' });

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe('https://opencode.ai/inference/go/openai/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer oc_test_key');
    expect(init.headers['User-Agent']).toBe('temtrend-api/1.0');
    expect(init.headers['x-opencode-session']).toBe('temtrend-user-1');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('deepseek-v4.1-flash');
    expect(body.reasoning_effort).toBe('none');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.name).toBe('catalog_decision');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.max_tokens).toBe(AI_LIMITS.CLASSIFY_MAX_OUTPUT_TOKENS);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toContain('halteres baratos');
  });

  it('aceita JSON cercado por bloco markdown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatResponse('```json\n' + DECISION_JSON + '\n```')));

    const { classifyCatalogRequest } = await loadService();
    const result = await classifyCatalogRequest('halteres', [PRODUCT as never]);
    expect(result?.selected_product_ids).toEqual(['p1']);
  });

  it('mapeia tokens de raciocínio no usage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatResponse(DECISION_JSON, {
      usage: { prompt_tokens: 10, completion_tokens: 90, total_tokens: 100, completion_tokens_details: { reasoning_tokens: 70 } },
    })));

    const { classifyCatalogRequest } = await loadService();
    const result = await classifyCatalogRequest('halteres', [PRODUCT as never]);
    expect(result?.usage.thoughts_tokens).toBe(70);
  });

  it('descarta resposta truncada por max_tokens', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatResponse('{"in_scope":', { finishReason: 'length' })));

    const { classifyCatalogRequest } = await loadService();
    expect(await classifyCatalogRequest('halteres', [PRODUCT as never])).toBeNull();
  });

  it('pede uma regeneração quando o roteiro serviria para qualquer produto', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(chatResponse(GENERIC_PACKAGE))
      .mockResolvedValueOnce(chatResponse(SPECIFIC_PACKAGE));
    vi.stubGlobal('fetch', fetchMock);

    const { generateContentKit } = await loadService();
    const result = await generateContentKit(FULL_PRODUCT as never, [], 'sem aparecer', null, 'user-1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse((fetchMock.mock.calls[1] as [string, { body: string }])[1].body);
    expect(secondBody.messages[1].content).toContain('servia para qualquer produto');
    expect(secondBody.messages[0].content).toContain('TESTE DA TROCA');
    expect(result?.content_kit.hook).toBe('Olha como o divisor encaixa na gaveta.');
  });

  it('retorna null em erro HTTP ou sem credencial', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    const { classifyCatalogRequest } = await loadService();
    expect(await classifyCatalogRequest('halteres', [PRODUCT as never])).toBeNull();

    vi.stubEnv('OPENCODE_API_KEY', '');
    expect(await classifyCatalogRequest('outro termo', [PRODUCT as never])).toBeNull();
  });
});
