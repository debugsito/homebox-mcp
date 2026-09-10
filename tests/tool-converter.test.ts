import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { toolSchemaToJSONSchema } from '../src/modules/ai/tool-converter.js';

describe('toolSchemaToJSONSchema', () => {
  it('marca requerido solo lo que no es opcional ni tiene default', () => {
    const schema = z.object({
      query: z.string(),
      limit: z.number().int().positive().optional().default(50),
      note: z.string().optional(),
    });

    const json = toolSchemaToJSONSchema(schema);

    expect(json.required).toEqual(['query']);
  });

  it('conserva el tipo entero en vez de colapsarlo a string', () => {
    const json = toolSchemaToJSONSchema(z.object({ page: z.number().int() }));

    expect(json.properties.page).toMatchObject({ type: 'integer' });
  });

  it('traduce enums, que la conversion anterior perdia', () => {
    const json = toolSchemaToJSONSchema(
      z.object({ sede: z.enum(['Homie', 'Casa Ventanilla']) })
    );

    expect(json.properties.sede).toMatchObject({ enum: ['Homie', 'Casa Ventanilla'] });
  });

  it('traduce arrays de strings', () => {
    const json = toolSchemaToJSONSchema(z.object({ tagIds: z.array(z.string()) }));

    expect(json.properties.tagIds).toMatchObject({ type: 'array', items: { type: 'string' } });
  });

  it('expande objetos anidados en linea, sin $ref', () => {
    const json = toolSchemaToJSONSchema(
      z.object({ ubicacion: z.object({ id: z.string(), nombre: z.string() }) })
    );

    expect(JSON.stringify(json)).not.toContain('$ref');
    expect(json.properties.ubicacion).toMatchObject({ type: 'object' });
  });

  it('no filtra $schema al payload que se manda al LLM', () => {
    const json = toolSchemaToJSONSchema(z.object({ q: z.string() })) as Record<string, unknown>;

    expect(json.$schema).toBeUndefined();
  });

  it('devuelve un objeto vacio valido para un schema sin campos', () => {
    expect(toolSchemaToJSONSchema(z.object({}))).toEqual({
      type: 'object',
      properties: {},
      required: [],
    });
  });
});
