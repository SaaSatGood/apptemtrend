import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/modules/assistant/openrouter.service.js', () => ({
  classifyCatalogRequest: vi.fn(),
  generateContentKit: vi.fn(),
}));

vi.mock('../src/modules/assistant/gemini.service.js', () => ({
  classifyCatalogRequest: vi.fn(),
}));

vi.mock('../src/modules/assistant/gemini-generation.service.js', () => ({
  generateContentKit: vi.fn(),
}));

const decision = {
  in_scope: true,
  intent_summary: 'x',
  search_terms: [],
  selected_product_ids: [],
  motivos: {},
  provider: 'openrouter',
  usage: { prompt_tokens: 1, response_tokens: 1, thoughts_tokens: 0, total_tokens: 2 },
  latency_ms: 1,
};

async function loadAiService() {
  vi.resetModules();
  return import('../src/modules/assistant/ai.service.js');
}

async function mockedTransports() {
  const or = await import('../src/modules/assistant/openrouter.service.js');
  const gem = await import('../src/modules/assistant/gemini.service.js');
  const gen = await import('../src/modules/assistant/gemini-generation.service.js');
  return {
    orClassify: vi.mocked(or.classifyCatalogRequest),
    orGenerate: vi.mocked(or.generateContentKit),
    geminiClassify: vi.mocked(gem.classifyCatalogRequest),
    geminiGenerate: vi.mocked(gen.generateContentKit),
  };
}

describe('AI provider routing', () => {
  beforeEach(() => {
    // NODE_ENV=test desliga providers por desenho; simula produção aqui.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
    vi.stubEnv('CORS_ORIGIN', 'https://example.com');
    vi.stubEnv('FRONTEND_URL', 'https://example.com');
    vi.stubEnv('AI_PROVIDER', 'openrouter');
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('usa openrouter como primário quando configurado', async () => {
    const { AIService } = await loadAiService();
    const t = await mockedTransports();
    t.orClassify.mockResolvedValue(decision as never);
    const result = await AIService.interpretIntent('mensagem', []);
    expect(result).toBe(decision);
    expect(t.geminiClassify).not.toHaveBeenCalled();
  });

  it('cai para o secundário quando o primário falha', async () => {
    const { AIService } = await loadAiService();
    const t = await mockedTransports();
    t.orClassify.mockResolvedValue(null);
    t.geminiClassify.mockResolvedValue({ ...decision, provider: 'gemini' } as never);
    const result = await AIService.interpretIntent('mensagem', []);
    expect(result?.provider).toBe('gemini');
  });

  it('cai para o secundário na geração de kit', async () => {
    const { AIService } = await loadAiService();
    const t = await mockedTransports();
    t.orGenerate.mockResolvedValue(null);
    t.geminiGenerate.mockResolvedValue({ content_kit: { titulo: 'Kit' } } as never);
    const product = { id: 'p1', nome: 'Produto' };
    const result = await AIService.generateContentKit(product as never, [], undefined, null);
    expect(result).toMatchObject({ content_kit: { titulo: 'Kit' } });
    expect(t.geminiGenerate).toHaveBeenCalled();
  });

  it('expõe o provider ativo no status', async () => {
    const { aiStatus } = await loadAiService();
    expect(aiStatus()).toMatchObject({ provider: 'openrouter', configured: true });
  });
});
