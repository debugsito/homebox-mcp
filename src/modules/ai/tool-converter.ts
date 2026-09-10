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
    // jsonSchema7 y no openApi3: este ultimo emite exclusiveMinimum como
    // booleano al estilo Draft-4, y los proveedores validan contra 2020-12,
    // donde ese campo tiene que ser un numero. Groq lo rechaza con un 400.
    target: 'jsonSchema7',
  }) as Record<string, unknown>;

  delete converted.$schema;

  return {
    type: 'object',
    properties: (converted.properties as Record<string, unknown>) ?? {},
    required: (converted.required as string[]) ?? [],
  };
}
