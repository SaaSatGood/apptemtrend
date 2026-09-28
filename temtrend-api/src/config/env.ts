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
  TIKTOK_CLIENT_KEY: z.string().min(1).optional(),
  TIKTOK_CLIENT_SECRET: z.string().min(1).optional(),
  TIKTOK_REDIRECT_URI: z.string().url().optional(),
  TIKTOK_TOKEN_ENCRYPTION_KEY: z.string().min(1).optional(),
  TIKTOK_UPLOAD_CHUNK_SIZE: z.coerce.number().int().min(5 * 1024 * 1024).max(64 * 1024 * 1024).default(10 * 1024 * 1024),
  TIKTOK_MAX_VIDEO_SIZE: z.coerce.number().int().positive().max(4 * 1024 * 1024 * 1024).default(4 * 1024 * 1024 * 1024),
  FFPROBE_PATH: z.string().default('ffprobe'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
