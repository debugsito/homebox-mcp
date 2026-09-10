import { describe, it, expect, vi, afterEach } from 'vitest';
import { AttachPhotoTool } from '../src/modules/tools/homebox/attach-photo.tool.js';
import { HomeBoxService } from '../src/modules/homebox/homebox.service.js';
import { HomeBoxClient } from '../src/modules/homebox/homebox.client.js';

// PNG de 1x1 transparente.
const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function toolConEspia() {
  const service = new HomeBoxService({} as never);
  const subir = vi
    .spyOn(service, 'uploadAttachment')
    .mockResolvedValue({ id: 'att-1', title: 'foto.png', type: 'photo', mimeType: 'image/png', primary: true });
  return { tool: new AttachPhotoTool(service), subir };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AttachPhotoTool', () => {
  it('decodifica base64 pelado y sube los bytes', async () => {
    const { tool, subir } = toolConEspia();

    const res = await tool.execute({ itemId: 'item-1', imageBase64: PNG_1x1, mimeType: 'image/png' });

    expect(res).toMatchObject({ attachmentId: 'att-1', itemId: 'item-1' });
    const payload = subir.mock.calls[0][1];
    expect(payload.file.byteLength).toBeGreaterThan(0);
    expect(payload.mimeType).toBe('image/png');
  });

  it('acepta también un data URI, que es como suele llegar del cliente', async () => {
    const { tool, subir } = toolConEspia();

    await tool.execute({
      itemId: 'item-1',
      imageBase64: `data:image/png;base64,${PNG_1x1}`,
      mimeType: 'image/png',
    });

    const conPrefijo = subir.mock.calls[0][1].file.byteLength;
    expect(conPrefijo).toBeGreaterThan(0);
  });

  it('sube como photo primary para que quede de miniatura', async () => {
    const { tool, subir } = toolConEspia();

    await tool.execute({ itemId: 'item-1', imageBase64: PNG_1x1, mimeType: 'image/png' });

    expect(subir.mock.calls[0][1]).toMatchObject({ type: 'photo', primary: true });
  });

  it('permite adjuntar sin convertirla en miniatura', async () => {
    const { tool, subir } = toolConEspia();

    await tool.execute({
      itemId: 'item-1',
      imageBase64: PNG_1x1,
      mimeType: 'image/png',
      primary: false,
    });

    expect(subir.mock.calls[0][1].primary).toBe(false);
  });

  it('rechaza un campo de imagen vacío en la validación del esquema', async () => {
    const { tool } = toolConEspia();

    await expect(
      tool.execute({ itemId: 'item-1', imageBase64: '', mimeType: 'image/png' })
    ).rejects.toThrow('Invalid input');
  });

  it('rechaza base64 que decodifica a cero bytes, que el esquema sí deja pasar', async () => {
    const { tool, subir } = toolConEspia();

    await expect(
      tool.execute({ itemId: 'item-1', imageBase64: '   ', mimeType: 'image/png' })
    ).rejects.toThrow('La imagen viene vacía');
    expect(subir).not.toHaveBeenCalled();
  });

  it('rechaza un mimeType que no es imagen', async () => {
    const { tool } = toolConEspia();

    await expect(
      tool.execute({ itemId: 'item-1', imageBase64: PNG_1x1, mimeType: 'application/pdf' })
    ).rejects.toThrow('Invalid input');
  });

  it('rechaza por encima del límite de subida de HomeBox', async () => {
    const { tool, subir } = toolConEspia();
    const gigante = Buffer.alloc(51 * 1024 * 1024).toString('base64');

    await expect(
      tool.execute({ itemId: 'item-1', imageBase64: gigante, mimeType: 'image/jpeg' })
    ).rejects.toThrow('límite son 50 MB');
    expect(subir).not.toHaveBeenCalled();
  });
});

describe('HomeBoxClient.uploadAttachment', () => {
  it('manda multipart sin fijar Content-Type, para no romper el boundary', async () => {
    let headers: Record<string, string> = {};
    let body: unknown;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, options: RequestInit) => {
        headers = options.headers as Record<string, string>;
        body = options.body;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          // El POST responde con la entidad entera, no con el adjunto.
          json: async () => ({
            id: 'item-1',
            name: 'Mousepad',
            attachments: [
              { id: 'att-1', title: 'foto.jpg', type: 'photo', mimeType: 'image/jpeg', primary: true, createdAt: '2026-09-10T00:00:00Z' },
            ],
          }),
        } as Response;
      })
    );

    await new HomeBoxClient().uploadAttachment('item-1', {
      file: new Uint8Array([1, 2, 3]),
      filename: 'foto.jpg',
      mimeType: 'image/jpeg',
      type: 'photo',
      primary: true,
    });

    expect(body).toBeInstanceOf(FormData);
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers.Authorization).toMatch(/^Bearer /);
    expect((body as FormData).get('type')).toBe('photo');
    expect((body as FormData).get('primary')).toBe('true');
  });

  it('elige el adjunto recién subido de entre los que ya tenía la ficha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: 'item-1',
          attachments: [
            { id: 'viejo', title: 'otra.jpg', type: 'photo', mimeType: 'image/jpeg', primary: false, createdAt: '2026-01-01T00:00:00Z' },
            { id: 'nuevo', title: 'foto.jpg', type: 'photo', mimeType: 'image/jpeg', primary: true, createdAt: '2026-09-10T00:00:00Z' },
          ],
        }),
      })) as unknown as typeof fetch
    );

    const res = await new HomeBoxClient().uploadAttachment('item-1', {
      file: new Uint8Array([1]),
      filename: 'foto.jpg',
      mimeType: 'image/jpeg',
    });

    expect(res.id).toBe('nuevo');
  });

  it('falla claro si HomeBox acepta la subida pero no devuelve adjuntos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 'item-1', attachments: [] }),
      })) as unknown as typeof fetch
    );

    await expect(
      new HomeBoxClient().uploadAttachment('item-1', {
        file: new Uint8Array([1]),
        filename: 'foto.jpg',
        mimeType: 'image/jpeg',
      })
    ).rejects.toThrow('no devolvió el adjunto');
  });

  it('no revienta con un 204 sin cuerpo al borrar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 204,
        headers: new Headers(),
        json: async () => {
          throw new Error('no debería llamarse');
        },
      })) as unknown as typeof fetch
    );

    await expect(new HomeBoxClient().deleteAttachment('item-1', 'att-1')).resolves.toBeUndefined();
  });
});
