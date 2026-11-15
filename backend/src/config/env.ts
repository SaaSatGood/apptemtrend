import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  SERVICE_NAME: z.string().trim().min(1).default('temtrend-api'),
  RELEASE: z.string().trim().min(1).optional(),
  /** Webhook opcional (Slack/Discord) para alertar erros 5xx e falhas de webhook. */
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default('gemini-3.1-flash-lite'),
  AI_PROVIDER: z.enum(['gemini', 'openrouter', 'opencode']).default('gemini'),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().default('google/gemma-4-31b-it:free'),
  // OpenCode Go (Console): API compatível com OpenAI (DeepSeek V4.1, Kimi, GLM...).
  OPENCODE_API_KEY: z.string().min(1).optional(),
  OPENCODE_MODEL: z.string().default('deepseek-v4.1-flash'),
  OPENCODE_BASE_URL: z.string().url().default('https://opencode.ai/inference/go/openai/v1'),
  // Modelos de raciocínio gastam max_tokens "pensando" e truncam o JSON.
  // "none" desliga o raciocínio nos fluxos estruturados (classificação/kit/suporte).
  OPENCODE_REASONING_EFFORT: z.enum(['none', 'low', 'high', 'max']).default('none'),
  REDIS_URL: z.string().url().optional(),
  AI_QUOTA_STORE: z.enum(['database', 'memory']).default(
    process.env.NODE_ENV === 'production' ? 'database' : 'memory',
  ),
  CATALOG_FEED_URL: z.string().url().optional(),
  CATALOG_FEED_TOKEN: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_AUDIENCE_ID: z.string().min(1).optional(),
  // Remetente dos e-mails transacionais (cadastro). Precisa ser um endereço
  // do domínio verificado no Resend.
  EMAIL_FROM: z.string().trim().min(3).optional(),
  // Billing (AbacatePay). Desligado por padrão: o app segue com as cotas globais.
  BILLING_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  ABACATEPAY_API_KEY: z.string().min(1).optional(),
  ABACATEPAY_API_URL: z.string().url().default('https://api.abacatepay.com/v2'),
  ABACATEPAY_WEBHOOK_SECRET: z.string().min(8).optional(),
  // IDs dos produtos criados na loja; sobreponíveis por env.
  // Pro: assinatura recorrente (cartão). Pro PIX: cobrança avulsa por período.
  ABACATEPAY_PRODUCT_PRO_MENSAL: z.string().min(1).optional(),
  ABACATEPAY_PRODUCT_PRO_ANUAL: z.string().min(1).optional(),
  ABACATEPAY_PRODUCT_PRO_MENSAL_PIX: z.string().min(1).optional(),
  ABACATEPAY_PRODUCT_PRO_ANUAL_PIX: z.string().min(1).optional(),
  ABACATEPAY_PRODUCT_LAUNCH_MENSAL: z.string().min(1).optional(),
  ABACATEPAY_PRODUCT_LAUNCH_ANUAL: z.string().min(1).optional(),
  ABACATEPAY_PRODUCT_LAUNCH_MENSAL_PIX: z.string().min(1).optional(),
  ABACATEPAY_PRODUCT_LAUNCH_ANUAL_PIX: z.string().min(1).optional(),
  // Legado: necessários apenas para reconhecer assinaturas antigas.
  ABACATEPAY_PRODUCT_ESSENCIAL_MENSAL: z.string().min(1).optional(),
  ABACATEPAY_PRODUCT_ESSENCIAL_ANUAL: z.string().min(1).optional(),
  ABACATEPAY_PRODUCT_SCALE_MENSAL: z.string().min(1).optional(),
  ABACATEPAY_PRODUCT_SCALE_ANUAL: z.string().min(1).optional(),
  // Billing Asaas (cartão recorrente). O PIX segue no AbacatePay.
  ASAAS_API_KEY: z.string().min(1).optional(),
  ASAAS_API_URL: z.string().url().default('https://api.asaas.com'),
  ASAAS_WEBHOOK_TOKEN: z.string().min(16).optional(),
  /** URL pública (HTTPS) usada no retorno do Checkout Asaas. Localhost não é aceito pelo provedor. */
  ASAAS_CALLBACK_BASE_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
