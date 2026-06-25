import { toolRegistry } from '../tools/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodSchema = any;

/**
 * Converts our internal Tool registry to OpenAI-compatible function format.
 */
export function getToolsForLLM(): OpenAIFunction[] {
  const tools = toolRegistry.getAll();

  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toolSchemaToJSONSchema(tool.inputSchema),
    },
  }));
}

/**
 * Unwrap ZodDefault and ZodOptional wrappers to get the base type definition.
 * Returns { isOptional, baseDef }
 */
function unwrapZod(value: any): { isOptional: boolean; baseDef: any } {
  let isOptional = false;
  let current = value;

  while (current && current._def) {
    const typeName = current._def.typeName;

    if (typeName === 'ZodOptional') {
      isOptional = true;
      current = current._def.innerType;
    } else if (typeName === 'ZodDefault') {
      // ZodDefault wraps ZodOptional, so if the inner is optional, mark it
      const inner = current._def.innerType;
      if (inner._def.typeName === 'ZodOptional') {
        isOptional = true;
        current = inner._def.innerType;
      } else {
        current = inner;
      }
    } else {
      break;
    }
  }

  return { isOptional, baseDef: current?._def };
}

/**
 * Convert a Zod schema to JSON Schema format for OpenAI API.
 */
function toolSchemaToJSONSchema(schema: ZodSchema): JSONSchemaDefinition {
  try {
    const shape = schema._def?.shape?.();
    if (!shape) {
      return { type: 'object', properties: {}, required: [] };
    }

    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prop = value as any;
      const { isOptional, baseDef } = unwrapZod(prop);

      if (!baseDef) {
        properties[key] = { type: 'string' };
        continue;
      }

      if (baseDef.typeName === 'ZodString') {
        properties[key] = { type: 'string' };
      } else if (baseDef.typeName === 'ZodNumber') {
        properties[key] = { type: 'number' };
      } else if (baseDef.typeName === 'ZodBoolean') {
        properties[key] = { type: 'boolean' };
      } else {
        properties[key] = { type: 'string' };
      }

      // Non-optional fields are required
      if (!isOptional) {
        required.push(key);
      }
    }

    return { type: 'object', properties, required };
  } catch {
    return { type: 'object', properties: {}, required: [] };
  }
}

interface OpenAIFunction {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchemaDefinition;
  };
}

interface JSONSchemaDefinition {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
}
