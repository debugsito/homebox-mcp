import { describe, it, expect, vi } from 'vitest';
import { FindItemTool } from '../src/modules/tools/homebox/find-item.tool.js';
import { HomeBoxService } from '../src/modules/homebox/homebox.service.js';
import type { HomeBoxEntity } from '../src/modules/homebox/homebox.types.js';

const hdmi: HomeBoxEntity = {
  id: 'item-1',
  name: 'Extensor HDMI via UTP',
  description: 'extensor por cable de red',
  parent: { id: 'cajon1', name: 'Cajon 1' },
};

function toolWith(items: HomeBoxEntity[], path: { id: string; name: string; type: string }[]) {
  const service = new HomeBoxService({} as never);
  vi.spyOn(service, 'listAllItems').mockResolvedValue(items);
  vi.spyOn(service, 'getItemById').mockImplementation(
    async (id) => items.find((i) => i.id === id) as HomeBoxEntity
  );
  vi.spyOn(service, 'getItemPath').mockResolvedValue(path);
  return new FindItemTool(service);
}

const fullPath = [
  { id: 'homie', name: 'Homie', type: 'location' },
  { id: 'oficina', name: 'Cuarto Oficina', type: 'location' },
  { id: 'cajones', name: 'Cajones Escritorio', type: 'location' },
  { id: 'cajon1', name: 'Cajon 1', type: 'location' },
  { id: 'item-1', name: 'Extensor HDMI via UTP', type: 'item' },
];

describe('FindItemTool', () => {
  it('arma la ruta completa, no solo el contenedor inmediato', async () => {
    const result = await toolWith([hdmi], fullPath).execute({ query: 'hdmi' });

    expect(result.matches?.[0].locationPath).toBe(
      'Homie > Cuarto Oficina > Cajones Escritorio > Cajon 1'
    );
  });

  it('excluye el propio item de la ruta', async () => {
    const result = await toolWith([hdmi], fullPath).execute({ query: 'hdmi' });

    expect(result.matches?.[0].locationPath).not.toContain('Extensor HDMI');
  });

  it('quita los articulos del query antes de buscar', async () => {
    const result = await toolWith([hdmi], fullPath).execute({ query: 'el hdmi' });

    expect(result.found).toBe(true);
  });

  it('cae al nombre del contenedor si el endpoint de path falla', async () => {
    const service = new HomeBoxService({} as never);
    vi.spyOn(service, 'listAllItems').mockResolvedValue([hdmi]);
    vi.spyOn(service, 'getItemById').mockResolvedValue(hdmi);
    vi.spyOn(service, 'getItemPath').mockRejectedValue(new Error('502'));

    const result = await new FindItemTool(service).execute({ query: 'hdmi' });

    expect(result.matches?.[0].locationPath).toBe('Cajon 1');
  });

  it('informa found:false cuando no existe', async () => {
    const result = await toolWith([hdmi], fullPath).execute({ query: 'taladro' });

    expect(result).toEqual({ found: false });
  });

  it('devuelve todos los candidatos marcando ambiguo', async () => {
    const otro: HomeBoxEntity = { id: 'item-2', name: 'Cable HDMI corto', parent: { id: 'cajon1', name: 'Cajon 1' } };
    const result = await toolWith([hdmi, otro], fullPath).execute({ query: 'hdmi' });

    expect(result.ambiguous).toBe(true);
    expect(result.count).toBe(2);
    expect(result.matches).toHaveLength(2);
  });

  it('rechaza un query vacio', async () => {
    await expect(toolWith([hdmi], fullPath).execute({ query: '' })).rejects.toThrow('Invalid input');
  });
});
