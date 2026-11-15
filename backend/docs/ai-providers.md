# Provedores de IA

A TemTrend fala com a IA por uma unica camada (`src/modules/assistant/ai.service.ts`).
O provedor principal vem de `AI_PROVIDER` e os demais entram como fallback, na ordem:

| AI_PROVIDER | 1o | 2o | 3o |
| --- | --- | --- | --- |
| `gemini` | gemini | opencode | openrouter |
| `openrouter` | openrouter | opencode | gemini |
| `opencode` | opencode | gemini | openrouter |

Provedor sem credencial e ignorado automaticamente.

## OpenCode Go (DeepSeek V4.1)

API compativel com OpenAI Chat Completions do plano Go do OpenCode Console:

```bash
OPENCODE_API_KEY=oc_sk_...
OPENCODE_MODEL=deepseek-v4.1-flash
OPENCODE_BASE_URL=https://opencode.ai/inference/go/openai/v1
OPENCODE_REASONING_EFFORT=none
```

- **Regiao:** o Go bloqueia modelos que treinam com os dados e limita regioes a
  Europa/EUA por padrao. O DeepSeek V4.1 exige `Settings > Privacy > Regions = Global`
  no Console (owner/admin).
- **Reasoning:** DeepSeek V4.1 e modelo de raciocinio; os tokens de "thinking"
  contam no `max_tokens`. Com `reasoning_effort=low` o kit de 3000 tokens truncava
  o JSON (1819 tokens gastos pensando). Por isso o padrao e `none`.
- **JSON garantido:** classificacao e geracao usam `response_format: json_schema`
  (strict), o que impede chaves extras e campos faltando.
- **Sessao:** todo request envia `x-opencode-session` estavel por creator e um
  `User-Agent` proprio (`temtrend-api/1.0`), como o Go pede.
- **Limites:** o plano Go tem teto mensal por modelo; cada resposta traz
  `usage.opencode.allowance` com o consumo cobrado.

## Trocar de modelo/provedor sem deploy

Basta mudar as variaveis de ambiente e reiniciar a API. `GET /ready` mostra
`ai_provider` e `ai_model` ativos.
