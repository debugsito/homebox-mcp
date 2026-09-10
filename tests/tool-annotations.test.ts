import { describe, it, expect } from 'vitest';
import { toolRegistry } from '../src/modules/tools/index.js';

const SOLO_LECTURA = [
  'find_item',
  'search_item',
  'get_item',
  'list_items',
  'list_locations',
  'resolve_item',
  'resolve_location',
];
const ESCRITURA = ['create_item', 'update_item', 'move_item', 'attach_photo'];

describe('anotaciones de las tools', () => {
  it('registra las 11 tools', () => {
    expect(toolRegistry.listNames().sort()).toEqual([...SOLO_LECTURA, ...ESCRITURA].sort());
  });

  it.each(SOLO_LECTURA)('%s no modifica nada', (name) => {
    const tool = toolRegistry.get(name);
    expect(tool?.readOnly).toBe(true);
    expect(tool?.destructive).toBe(false);
  });

  it.each(ESCRITURA)('%s está marcada como escritura', (name) => {
    expect(toolRegistry.get(name)?.readOnly).toBe(false);
  });

  it.each(['create_item', 'attach_photo'])('%s es aditiva, no destructiva', (name) => {
    expect(toolRegistry.get(name)?.destructive).toBe(false);
  });

  it.each(['update_item', 'move_item'])('%s sí es destructiva: cambia algo existente', (name) => {
    expect(toolRegistry.get(name)?.destructive).toBe(true);
  });

  it('toda tool declara descripción y esquema', () => {
    for (const tool of toolRegistry.getAll()) {
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema).toBeDefined();
    }
  });
});
