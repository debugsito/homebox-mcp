import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOMEBOX_URL: z.string().url(),
  HOMEBOX_API_KEY: z.string().min(1),
  AI_PROVIDER: z.enum(['groq', 'gemini', 'minimax']).default('groq'),
  GROQ_API_KEY: z.string().min(1),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  MINIMAX_API_KEY: z.string().optional(),
  MINIMAX_MODEL: z.string().default('minimax/MiniMax-M2.7'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
