import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HomeBoxClient } from '../src/modules/homebox/homebox.client.js';

interface CapturedCall {
  url: string;
  method: string;
  body: Record<string, unknown> | undefined;
}

let calls: CapturedCall[] = [];

function mockFetch(responder: (url: string, method: string) => unknown) {
  return vi.fn(async (url: string, options: RequestInit = {}) => {
    const method = options.method ?? 'GET';
    calls.push({
      url,
      method,
      body: options.body ? JSON.parse(options.body as string) : undefined,
    });
    return {
      ok: true,
      status: 200,
      json: async () => responder(url, method),
    } as Response;
  });
}

const existingEntity = {
  id: 'item-1',
  name: 'camara ip',
  description: 'descripcion original',
  quantity: 3,
  parent: { id: 'cuarto-sebas', name: 'Cuarto Sebas' },
  entityType: { id: 'gadgets', name: 'Gadgets', isLocation: false },
  serialNumber: 'SN-123',
};

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('updateEntity', () => {
  it('usa PATCH cuando solo cambian campos que PATCH acepta', async () => {
    vi.stubGlobal('fetch', mockFetch(() => existingEntity));

    await new HomeBoxClient().updateEntity('item-1', { quantity: 5 });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].body).toEqual({ quantity: 5 });
  });

  it('usa PUT para renombrar, porque PATCH descarta name en silencio', async () => {
    vi.stubGlobal('fetch', mockFetch(() => existingEntity));

    await new HomeBoxClient().updateEntity('item-1', { name: 'Cámara IP' });

    expect(calls.map((c) => c.method)).toEqual(['GET', 'PUT']);
    expect(calls[1].body).toMatchObject({ id: 'item-1', name: 'Cámara IP' });
  });

  it('conserva los campos no tocados al reemplazar via PUT', async () => {
    vi.stubGlobal('fetch', mockFetch(() => existingEntity));

    await new HomeBoxClient().updateEntity('item-1', { name: 'Cámara IP' });

    expect(calls[1].body).toMatchObject({
      description: 'descripcion original',
      quantity: 3,
      serialNumber: 'SN-123',
      parentId: 'cuarto-sebas',
      entityTypeId: 'gadgets',
    });
  });

  it('permite vaciar la descripcion sin perder el nombre', async () => {
    vi.stubGlobal('fetch', mockFetch(() => existingEntity));

    await new HomeBoxClient().updateEntity('item-1', { description: '' });

    expect(calls[1].method).toBe('PUT');
    expect(calls[1].body).toMatchObject({ name: 'camara ip', description: '' });
  });
});

describe('listAllEntities', () => {
  it('recorre todas las paginas en vez de quedarse en la primera', async () => {
    const total = 250;
    vi.stubGlobal(
      'fetch',
      mockFetch((url) => {
        const page = Number(new URL(url).searchParams.get('page'));
        const pageSize = Number(new URL(url).searchParams.get('pageSize'));
        const start = (page - 1) * pageSize;
        const items = Array.from({ length: Math.max(0, Math.min(pageSize, total - start)) }, (_, i) => ({
          id: `item-${start + i}`,
          name: `Item ${start + i}`,
        }));
        return { page, pageSize, total, items };
      })
    );

    const all = await new HomeBoxClient().listAllEntities(100);

    expect(all).toHaveLength(total);
    expect(calls).toHaveLength(3);
    expect(all.at(-1)?.id).toBe('item-249');
  });

  it('para en la primera pagina cuando el inventario cabe entero', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(() => ({ page: 1, pageSize: 200, total: 2, items: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }))
    );

    const all = await new HomeBoxClient().listAllEntities();

    expect(all).toHaveLength(2);
    expect(calls).toHaveLength(1);
  });
});

describe('getEntityPath', () => {
  it('pide la cadena de ancestros al endpoint dedicado', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(() => [
        { id: 'homie', name: 'Homie', type: 'location' },
        { id: 'cajon1', name: 'Cajon 1', type: 'location' },
        { id: 'item-1', name: 'Extensor HDMI', type: 'item' },
      ])
    );

    const path = await new HomeBoxClient().getEntityPath('item-1');

    expect(calls[0].url).toContain('/api/v1/entities/item-1/path');
    expect(path.map((s) => s.name)).toEqual(['Homie', 'Cajon 1', 'Extensor HDMI']);
  });
});
