import { z } from 'zod';

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  history: z.array(chatMessageSchema).optional().default([]),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
