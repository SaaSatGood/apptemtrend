# Integração oficial com TikTok

Esta integração usa **Login Kit OAuth 2.0** e **Content Posting API / Direct Post**. Nenhuma automação de navegador, cookie de sessão ou endpoint não oficial é usado.

## Fluxo implementado

1. O creator conecta o TikTok em **Configurações**.
2. O backend gera `state` criptograficamente aleatório, salva-o com validade de 10 minutos e redireciona para o Login Kit.
3. O callback consome o `state` uma única vez, troca o código por tokens e armazena access/refresh tokens com AES-256-GCM.
4. No Content Kit, o creator escolhe **Enviar vídeo ao TikTok**.
5. O backend confirma ownership de `creator_content`, valida formato, assinatura, codec, FPS, resolução e duração com `ffprobe`, e envia o arquivo para o bucket privado `creator-videos`.
6. A tela mostra uma URL assinada temporária, legenda editável e apenas as opções de privacidade devolvidas pela conta TikTok.
7. O Direct Post é inicializado e o arquivo é enviado em chunks sequenciais com `Content-Range`.
8. O frontend consulta o status a cada 10 segundos. Em sucesso, `creator_content.status` passa para `publicado`; em falha, a tentativa pode ser repetida.

## Variáveis de ambiente do backend

Copie os campos abaixo para `.env` (sem prefixo `NEXT_PUBLIC_`):

```env
FRONTEND_URL=http://localhost:5173
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=http://localhost:3333/tiktok/callback
TIKTOK_TOKEN_ENCRYPTION_KEY=
TIKTOK_UPLOAD_CHUNK_SIZE=10485760
TIKTOK_MAX_VIDEO_SIZE=4294967296
FFPROBE_PATH=ffprobe
```

Gere a chave de criptografia uma vez e guarde-a no gerenciador de segredos do ambiente:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Não troque essa chave sem antes recriptografar os tokens já salvos. Nunca exponha `TIKTOK_CLIENT_SECRET`, `TIKTOK_TOKEN_ENCRYPTION_KEY` ou a Service Role no frontend.

## Configuração no TikTok for Developers

No aplicativo TikTok:

- habilite Login Kit;
- habilite Content Posting API / Direct Post;
- solicite os escopos `user.info.basic` e `video.publish`;
- cadastre exatamente o mesmo redirect URI configurado em `TIKTOK_REDIRECT_URI`;
- para produção, use uma URL HTTPS pública e atualize `FRONTEND_URL` e `TIKTOK_REDIRECT_URI`;
- conclua a auditoria exigida pelo TikTok para publicar além das limitações de aplicativos não auditados.

Aplicativos não auditados podem ficar limitados à privacidade `SELF_ONLY` e a contas privadas de teste. A interface respeita a lista de privacidade retornada por `creator_info`; não inventa opções.

## Banco e Storage

Execute em ordem:

1. `supabase/migrations/011_save_product_to_production.sql`
2. `supabase/migrations/012_tiktok_integration.sql`
3. `supabase/migrations/013_tiktok_security_followup.sql`
4. `supabase/migrations/014_rls_performance_hardening.sql`
5. `supabase/migrations/015_tiktok_active_upload_idempotency.sql`

A migration cria:

- `tiktok_oauth_states`;
- `tiktok_accounts`;
- `tiktok_posts`;
- bucket privado `creator-videos`;
- índices, constraints, RLS e grants que não expõem tokens.

Todas as gravações passam pelo backend com Service Role. Usuários autenticados só recebem leitura das próprias colunas não sensíveis.

## Dependência de vídeo

Instale FFmpeg/ffprobe no host do backend e confirme:

```powershell
ffprobe -version
```

Se o executável estiver em outro local, configure o caminho absoluto em `FFPROBE_PATH`.

Formatos aceitos: MP4, MOV e WebM. Codecs: H.264, H.265/HEVC, VP8 ou VP9. FPS: 23–60. Dimensões: 360–4096 px. A duração final respeita o menor valor entre 10 minutos e o limite retornado para o creator.

## Desenvolvimento local

```powershell
# API
cd temtrend-api
npm install
npm run dev

# frontend, em outro terminal
cd temtrend-web
npx vite --host 127.0.0.1 --port 5173
```

O callback local precisa ser aceito no painel TikTok. Caso o TikTok exija HTTPS público, use um domínio/túnel HTTPS estável e cadastre essa URL; não altere o callback dinamicamente.

## Operação e troubleshooting

- `TIKTOK_NOT_CONFIGURED`: faltam credenciais ou chave de criptografia.
- `TIKTOK_AUTHORIZATION_ERROR`: callback cancelado, expirado, `state` inválido ou redirect URI divergente.
- `TIKTOK_NOT_CONNECTED`: o creator ainda não conectou a conta ou a conexão foi revogada.
- `TIKTOK_TOKEN_EXPIRED`: refresh falhou; conecte novamente.
- `TIKTOK_VIDEO_INVALID`: formato, assinatura, codec, FPS, resolução, duração ou tamanho inválido.
- `TIKTOK_PRIVACY_INVALID`: opção não disponível para aquela conta.
- `TIKTOK_RATE_LIMITED`: aguarde antes de repetir.
- `TIKTOK_UPLOAD_ERROR`: falha no Storage ou na transferência em chunks.

Os logs usam IDs operacionais, nunca tokens. O publicador faz claim atômico de posts `pending`/`failed`, bloqueando publicações concorrentes. O polling é limitado e o backend só marca `publicado` após `PUBLISH_COMPLETE`.

## Verificação

```powershell
npm run typecheck
npm test
npm run build
```

O teste real de OAuth e publicação exige credenciais válidas, app configurado/aprovado e uma conta TikTok autorizada. Sem isso, o código, schemas, segurança, upload local e contratos são testáveis, mas a chamada externa não pode ser confirmada ponta a ponta.
