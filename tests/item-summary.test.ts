import { describe, it, expect, vi } from 'vitest';
import { summarizeItem, summarizeItems } from '../src/modules/homebox/item.summary.js';
import { ListItemsTool } from '../src/modules/tools/homebox/list-items.tool.js';
import { HomeBoxService } from '../src/modules/homebox/homebox.service.js';
import type { HomeBoxEntity } from '../src/modules/homebox/homebox.types.js';

const CRUDO: HomeBoxEntity = {
  id: 'item-1',
  name: 'Balanza',
  description: 'balanza digital de cocina',
  quantity: 1,
  assetId: '000-013',
  insured: false,
  archived: false,
  soldDate: '',
  purchasePrice: 0,
  createdAt: '2026-09-10T17:14:14Z',
  updatedAt: '2026-09-10T22:00:50Z',
  tags: [],
  parent: { id: 'cajon-2', name: 'Cajón 2', assetId: '000-002', createdAt: '...' },
  entityType: { id: 'tipo-1', name: 'Accesorio', isLocation: false, icon: 'box' },
};

describe('summarizeItem', () => {
  it('deja solo lo que el modelo necesita', () => {
    expect(summarizeItem(CRUDO)).toEqual({
      id: 'item-1',
      name: 'Balanza',
      description: 'balanza digital de cocina',
      type: 'Accesorio',
      location: 'Cajón 2',
    });
  });

  it('aplana parent y entityType a su nombre', () => {
    const r = summarizeItem(CRUDO);

    expect(r.location).toBe('Cajón 2');
    expect(r.type).toBe('Accesorio');
    expect(JSON.stringify(r)).not.toContain('cajon-2');
  });

  it('omite la cantidad cuando es 1, que es el valor por defecto', () => {
    expect(summarizeItem(CRUDO).quantity).toBeUndefined();
    expect(summarizeItem({ ...CRUDO, quantity: 6 }).quantity).toBe(6);
  });

  it('omite la descripción vacía en vez de mandar una cadena vacía', () => {
    expect(summarizeItem({ ...CRUDO, description: '' }).description).toBeUndefined();
  });

  it('sobrevive a una entidad sin padre ni tipo', () => {
    expect(summarizeItem({ id: 'x', name: 'Suelto' })).toEqual({ id: 'x', name: 'Suelto' });
  });

  it('recorta de verdad: menos de un tercio del original', () => {
    const antes = JSON.stringify(CRUDO).length;
    const despues = JSON.stringify(summarizeItem(CRUDO)).length;

    expect(despues).toBeLessThan(antes / 3);
  });

  it('summarizeItems mantiene el orden', () => {
    const r = summarizeItems([CRUDO, { ...CRUDO, id: 'item-2', name: 'Otro' }]);
    expect(r.map((x) => x.name)).toEqual(['Balanza', 'Otro']);
  });
});

const ARBOL = [
  {
    id: 'homie',
    name: 'Homie',
    children: [
      { id: 'cajon1', name: 'Cajón 1', children: [] },
      { id: 'cajon2', name: 'Cajón 2', children: [] },
    ],
  },
];

function toolCon(items: HomeBoxEntity[]) {
  const service = new HomeBoxService({} as never);
  vi.spyOn(service, 'listLocations').mockResolvedValue(ARBOL as never);
  const listar = vi
    .spyOn(service, 'listItems')
    .mockResolvedValue({ page: 1, pageSize: 50, total: items.length, items } as never);
  return { tool: new ListItemsTool(service), listar };
}

describe('ListItemsTool con filtro de ubicación', () => {
  it('sin location, no filtra por padre', async () => {
    const { tool, listar } = toolCon([CRUDO]);

    await tool.execute({});

    expect(listar).toHaveBeenCalledWith(1, 50, []);
  });

  it('resuelve el nombre de la ubicación a su id', async () => {
    const { tool, listar } = toolCon([CRUDO]);

    await tool.execute({ location: 'Cajón 2' });

    expect(listar).toHaveBeenCalledWith(1, 50, ['cajon2']);
  });

  it('pide concretar cuando la ubicación es ambigua', async () => {
    const { tool, listar } = toolCon([CRUDO]);

    const r = (await tool.execute({ location: 'Cajón' })) as { error: string; candidatos: string[] };

    expect(r.error).toContain('varias ubicaciones');
    expect(r.candidatos).toHaveLength(2);
    expect(listar).not.toHaveBeenCalled();
  });

  it('avisa en vez de devolver todo si la ubicación no existe', async () => {
    const { tool, listar } = toolCon([CRUDO]);

    const r = (await tool.execute({ location: 'Sótano' })) as { error: string };

    expect(r.error).toContain('No existe');
    expect(listar).not.toHaveBeenCalled();
  });

  it('devuelve los objetos ya resumidos', async () => {
    const { tool } = toolCon([CRUDO]);

    const r = (await tool.execute({})) as Record<string, unknown>[];

    expect(r[0]).not.toHaveProperty('insured');
    expect(r[0]).not.toHaveProperty('createdAt');
  });
});
