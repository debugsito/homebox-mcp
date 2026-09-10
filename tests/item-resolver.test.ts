import { describe, it, expect, vi } from 'vitest';
import { ItemResolverService } from '../src/modules/resolvers/item-resolver.service.js';
import { HomeBoxService } from '../src/modules/homebox/homebox.service.js';
import type { HomeBoxEntity } from '../src/modules/homebox/homebox.types.js';

function fakeService(items: HomeBoxEntity[]) {
  const client = {
    createEntity: async (payload: { name: string }) => ({ id: 'creado', ...payload }),
  };
  const service = new HomeBoxService(client as never);
  vi.spyOn(service, 'listAllItems').mockResolvedValue(items);
  return service;
}

describe('ItemResolverService', () => {
  it('no duplica un item que matchea por nombre y por descripcion a la vez', async () => {
    const service = fakeService([
      { id: '1', name: 'llaves cerradura', description: 'las llaves de la cerradura' },
    ]);

    const result = await new ItemResolverService(service).resolve('llaves');

    expect(result.count).toBe(1);
    expect(result.resolved).toBe(true);
    expect(result.ambiguous).toBe(false);
  });

  it('se queda con el score alto del nombre, no con el bajo de la descripcion', async () => {
    const service = fakeService([
      { id: 'exacto', name: 'hdmi', description: 'sin relacion' },
      { id: 'descripcion', name: 'cable generico', description: 'sirve para hdmi' },
    ]);

    const result = await new ItemResolverService(service).resolve('hdmi');

    expect(result.result.map((r) => r.id)).toEqual(['exacto', 'descripcion']);
  });

  it('marca ambiguo cuando hay mas de un candidato', async () => {
    const service = fakeService([
      { id: '1', name: 'cajon 1' },
      { id: '2', name: 'cajon 2' },
    ]);

    const result = await new ItemResolverService(service).resolve('cajon');

    expect(result.ambiguous).toBe(true);
    expect(result.count).toBe(2);
  });

  it('devuelve vacio sin marcar resuelto cuando no hay nada', async () => {
    const result = await new ItemResolverService(fakeService([])).resolve('taladro');

    expect(result).toMatchObject({ count: 0, resolved: false, ambiguous: false });
  });

  it('ignora acentos y mayusculas al buscar', async () => {
    const service = fakeService([{ id: '1', name: 'Cámara IP de Sebastián' }]);

    const result = await new ItemResolverService(service).resolve('camara ip');

    expect(result.resolved).toBe(true);
  });

  it('bota la cache cuando el servicio notifica una escritura', async () => {
    const service = fakeService([{ id: '1', name: 'viejo' }]);
    const resolver = new ItemResolverService(service);

    await resolver.resolve('viejo');
    await resolver.resolve('viejo');
    expect(service.listAllItems).toHaveBeenCalledTimes(1);

    // Simula un create/move/update pasando por el servicio compartido.
    await service.createItem({ name: 'nuevo' });
    await resolver.resolve('viejo');

    expect(service.listAllItems).toHaveBeenCalledTimes(2);
  });

  it('no bota la cache si la escritura fallo', async () => {
    const service = fakeService([{ id: '1', name: 'viejo' }]);
    vi.spyOn(service, 'createItem').mockRejectedValue(new Error('HomeBox API error: 500'));
    const resolver = new ItemResolverService(service);

    await resolver.resolve('viejo');
    await expect(service.createItem({ name: 'nuevo' })).rejects.toThrow();
    await resolver.resolve('viejo');

    expect(service.listAllItems).toHaveBeenCalledTimes(1);
  });
});
