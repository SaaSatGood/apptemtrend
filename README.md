# TemTrend

Monorepo do MVP TemTrend.

- `frontend/`: Next.js 16 e React 19.
- `backend/`: Fastify, Gemini e Supabase.
- `backend/supabase/migrations/`: schema canônico do PostgreSQL.

## Validação local

```bash
npm run verify
cd frontend && npm run test:e2e
```

## Produção

O frontend e o backend são implantados separadamente. Antes do deploy, aplique as migrations até `022`, configure o readiness probe em `/ready`, use Redis quando houver múltiplas instâncias e agende `npm run catalog:sync` caso um feed esteja configurado.

Consulte `backend/docs/DEPLOY.md` para o checklist completo.
