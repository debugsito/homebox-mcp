import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOMEBOX_URL: z.string().url(),
  HOMEBOX_API_KEY: z.string().min(1),
  AI_PROVIDER: z.enum(['groq', 'gemini', 'minimax']).default('groq'),
  GROQ_API_KEY: z.string().optional(),
  // Groq retiró los llama-3.x; gpt-oss-120b es el mayor con tool-calling.
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  GEMINI_API_KEY: z.string().optional(),
  // gemini-2.5-flash sigue en el listado pero ya no se sirve a cuentas nuevas.
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  MINIMAX_API_KEY: z.string().optional(),
  MINIMAX_MODEL: z.string().default('minimax/MiniMax-M2.7'),
  // El bot solo arranca si hay token; sin allowlist no responde a nadie.
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ALLOWED_CHAT_IDS: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  // Sin token, el transporte HTTP del MCP rechaza todo.
  MCP_AUTH_TOKEN: z.string().min(32, 'MCP_AUTH_TOKEN debe tener al menos 32 caracteres').optional(),
});

// Solo se exige la clave del proveedor elegido, no la de todos.
const KEY_POR_PROVEEDOR = {
  groq: 'GROQ_API_KEY',
  gemini: 'GEMINI_API_KEY',
  minimax: 'MINIMAX_API_KEY',
} as const;

const parsed = envSchema
  .superRefine((env, ctx) => {
    const required = KEY_POR_PROVEEDOR[env.AI_PROVIDER];
    if (!env[required]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [required],
        message: `${required} es obligatoria cuando AI_PROVIDER=${env.AI_PROVIDER}`,
      });
    }
  })
  .safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
