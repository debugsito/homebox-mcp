import type { z } from 'zod';

export interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
  /**
   * Si la tool solo lee. Lo consume MCP como readOnlyHint, y es lo que separa
   * de verdad consulta de escritura: hasta ahora eso vivia solo en el prompt.
   */
  readOnly: boolean;
  /** Si modifica o borra algo existente. Crear es aditivo, no destructivo. */
  destructive: boolean;
  execute(input: unknown): Promise<unknown>;
}

export interface ToolExecutionContext {
  toolName: string;
  input: unknown;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface ToolRunRequest {
  tool: string;
  input?: Record<string, unknown>;
}

export interface ToolRunResponseBase {
  success: boolean;
  tool: string;
  executionMs: number;
}

export interface ToolRunSuccessResponse extends ToolRunResponseBase {
  success: true;
  result: unknown;
  count?: number;
}

export interface ToolRunErrorResponse extends ToolRunResponseBase {
  success: false;
  error: string;
}

export type ToolRunResponse = ToolRunSuccessResponse | ToolRunErrorResponse;
