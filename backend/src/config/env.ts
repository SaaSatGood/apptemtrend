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
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default('gemini-3.1-flash-lite'),
  AI_PROVIDER: z.enum(['gemini', 'openrouter']).default('gemini'),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().default('google/gemma-4-31b-it:free'),
  REDIS_URL: z.string().url().optional(),
  AI_QUOTA_STORE: z.enum(['database', 'memory']).default(
    process.env.NODE_ENV === 'production' ? 'database' : 'memory',
  ),
  CATALOG_FEED_URL: z.string().url().optional(),
  CATALOG_FEED_TOKEN: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_AUDIENCE_ID: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
