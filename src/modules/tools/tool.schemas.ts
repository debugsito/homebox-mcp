import { z } from 'zod';

export const searchItemInputSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().int().positive().optional().default(50),
});

export type SearchItemInput = z.infer<typeof searchItemInputSchema>;

export const getItemInputSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export type GetItemInput = z.infer<typeof getItemInputSchema>;

export const listLocationsInputSchema = z.object({
  withItems: z.boolean().optional().default(false),
});

export type ListLocationsInput = z.infer<typeof listLocationsInputSchema>;

export const listItemsInputSchema = z.object({
  limit: z.number().int().positive().optional().default(50),
  page: z.number().int().positive().optional().default(1),
});

export type ListItemsInput = z.infer<typeof listItemsInputSchema>;

export const toolRunRequestSchema = z.object({
  tool: z.string().min(1, 'Tool name is required'),
  input: z.record(z.unknown()).optional().default({}),
});

export type ToolRunRequest = z.infer<typeof toolRunRequestSchema>;

// --- Write Tools ---

export const createItemInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  quantity: z.number().optional(),
});

export type CreateItemInput = z.infer<typeof createItemInputSchema>;

export const updateItemInputSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  parentId: z.string().optional(),
  quantity: z.number().optional(),
});

export type UpdateItemInput = z.infer<typeof updateItemInputSchema>;

export const moveItemInputSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  parentId: z.string().min(1, 'Parent/Location ID is required'),
});

export type MoveItemInput = z.infer<typeof moveItemInputSchema>;
