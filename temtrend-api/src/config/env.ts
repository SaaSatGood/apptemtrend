import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default('gemini-3.1-flash-lite'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
