# TemTrend — Deploy MVP (checklist)

## 1. Frontend (`temtrend-web`)
Ordem de configuração da API:
1. `window.TEMTREND_CONFIG.API_URL` via `config.js` (copie `config.example.js` → `config.js`, **não commitar**).
2. `localStorage temtrend_api_url`.
3. `meta[name="temtrend-api-url"]` em `app.html`.
4. `http://localhost:3333` se hostname for localhost.

Em produção, preencha **um** dos três primeiros. Sem isso o app mostra
"Serviço indisponível" em vez de quebrar silenciosamente.

## 2. Backend (`temtrend-api`)
Env obrigatórias: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`,
`NODE_ENV=production`, `CORS_ORIGIN` (separadas por vírgula, sem espaço extra —
o código faz trim), `FRONTEND_URL`, `GEMINI_API_KEY` (opcional; sem ela o
assistant usa fallback local e a geração retorna 503 amigável), `GEMINI_MODEL`.

## 3. Migrations Supabase
- `019_performance_indexes.sql` e `020_rls_hardening.sql` são aditivas (`IF NOT EXISTS` / drop+create de policy) e seguras.
- Gap `013–015`: arquivos TikTok antigos foram **removidos intencionalmente**
  (`012_tiktok_integration`, `013_tiktok_security_followup`,
  `014_rls_performance_hardening`, `015_tiktok_active_upload_idempotency`).
  O `012` atual é outro arquivo (`012_manual_publication_mvp.sql`).
- Se o banco de staging já aplicou os TikTok antigos: resete o staging ou
  marque como revertidas antes do push. Em banco novo, apenas `supabase db push`.
- Valide com `supabase db push --dry-run` antes da produção.

## 4. Custo IA
- `GET /admin/ai-usage` (admin) mostra chamadas, tokens, cache hits e cotas.
- Cotas diárias MVP: 100 buscas + 20 roteiros por usuário; `force_new` com
  cooldown de 60s por produto. Ajuste em `src/lib/ai-metrics.ts` (`AI_QUOTA`).
- Rate-limit por minuto: assistant 10, kit 5.

## 5. Checklist manual (não automatizável aqui)
OAuth Google callback, email recovery real, upload Storage real,
teste físico mobile/tablet, carga Gemini real.
