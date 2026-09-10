import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';
import { toolRegistry } from '../tools/index.js';

export interface JSONSchemaDefinition {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
}

export interface OpenAIFunction {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchemaDefinition;
  };
}

/** Convierte el registry interno al formato de funciones de OpenAI/Groq. */
export function getToolsForLLM(): OpenAIFunction[] {
  return toolRegistry.getAll().map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toolSchemaToJSONSchema(tool.inputSchema),
    },
  }));
}

/**
 * La conversion anterior leia `_def.typeName` a mano y colapsaba enums, arrays
 * y objetos anidados a `{type: 'string'}`. zod-to-json-schema los traduce bien.
 * `$refStrategy: 'none'` los expande en linea, que es lo unico que aceptan las
 * definiciones de funcion.
 */
export function toolSchemaToJSONSchema(schema: z.ZodType<unknown>): JSONSchemaDefinition {
  const converted = zodToJsonSchema(schema, {
    $refStrategy: 'none',
    target: 'openApi3',
  }) as Record<string, unknown>;

  delete converted.$schema;

  return {
    type: 'object',
    properties: (converted.properties as Record<string, unknown>) ?? {},
    required: (converted.required as string[]) ?? [],
  };
}
