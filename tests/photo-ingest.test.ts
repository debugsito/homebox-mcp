import { describe, it, expect, vi } from 'vitest';
import { PhotoIngestService } from '../src/modules/ingest/photo-ingest.service.js';
import { HomeBoxService } from '../src/modules/homebox/homebox.service.js';
import { GeminiProvider } from '../src/modules/ai/providers/gemini.provider.js';

const ARBOL = [
  {
    id: 'homie',
    name: 'Homie',
    children: [
      {
        id: 'oficina',
        name: 'Cuarto Oficina',
        children: [
          {
            id: 'estante',
            name: 'Estante Grande',
            children: [{ id: 'nicho1', name: 'Nicho 1', children: [] }],
          },
        ],
      },
    ],
  },
];

const IMAGEN = { data: 'AAAA', mimeType: 'image/jpeg' as const };

function montar(respuesta: unknown) {
  const service = new HomeBoxService({} as never);
  vi.spyOn(service, 'listLocations').mockResolvedValue(ARBOL as never);

  const provider = new GeminiProvider();
  const extraer = vi.spyOn(provider, 'extractFromImages').mockResolvedValue(respuesta as never);

  return { ingest: new PhotoIngestService(service, provider), service, extraer };
}

describe('PhotoIngestService.analizar', () => {
  it('mete el árbol de ubicaciones en el prompt', async () => {
    const { ingest, extraer } = montar({ objetos: [], notas: '' });

    await ingest.analizar([IMAGEN]);

    const prompt = extraer.mock.calls[0][0];
    expect(prompt).toContain('Homie > Cuarto Oficina > Estante Grande > Nicho 1');
  });

  it('añade la pista del usuario cuando la hay', async () => {
    const { ingest, extraer } = montar({ objetos: [], notas: '' });

    await ingest.analizar([IMAGEN], 'esto está en el cajón de arriba');

    expect(extraer.mock.calls[0][0]).toContain('esto está en el cajón de arriba');
  });

  it('acepta una ubicación que existe tal cual', async () => {
    const { ingest } = montar({
      objetos: [
        {
          nombre: 'Mousepad',
          descripcion: 'negro, grande',
          tipo: 'Accesorio',
          cantidad: 1,
          ubicacionSugerida: 'Homie > Cuarto Oficina > Estante Grande > Nicho 1',
          motivoUbicacion: 'ahí están los accesorios de escritorio',
          confianza: 'alta',
        },
      ],
      notas: '',
    });

    const p = await ingest.analizar([IMAGEN]);

    expect(p.objetos[0].ubicacionSugerida).toBe('Homie > Cuarto Oficina > Estante Grande > Nicho 1');
    expect(p.objetos[0].confianza).toBe('alta');
  });

  it('descarta una ubicación que el modelo se inventó', async () => {
    const { ingest } = montar({
      objetos: [
        {
          nombre: 'Taladro',
          descripcion: 'inalámbrico',
          tipo: 'Herramienta',
          cantidad: 1,
          ubicacionSugerida: 'Homie > Garaje > Banco de trabajo',
          motivoUbicacion: 'es donde van las herramientas',
          confianza: 'alta',
        },
      ],
      notas: '',
    });

    const p = await ingest.analizar([IMAGEN]);

    expect(p.objetos[0].ubicacionSugerida).toBe('');
    expect(p.objetos[0].confianza).toBe('baja');
    expect(p.objetos[0].motivoUbicacion).toContain('a mano');
  });

  it('rechaza que no llegue ninguna imagen', async () => {
    const { ingest } = montar({ objetos: [], notas: '' });

    await expect(ingest.analizar([])).rejects.toThrow('ninguna imagen');
  });
});

describe('PhotoIngestService.confirmar', () => {
  it('crea el objeto en la ubicación confirmada', async () => {
    const { ingest, service } = montar({});
    const crear = vi
      .spyOn(service, 'createItem')
      .mockResolvedValue({ id: 'nuevo-1', name: 'Mousepad' } as never);

    const creados = await ingest.confirmar([
      {
        nombre: 'Mousepad',
        descripcion: 'negro',
        cantidad: 1,
        ubicacionPath: 'Homie > Cuarto Oficina > Estante Grande > Nicho 1',
      },
    ]);

    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Mousepad', parentId: 'nicho1', quantity: 1 })
    );
    expect(creados).toEqual([{ id: 'nuevo-1', nombre: 'Mousepad' }]);
  });

  it('adjunta la foto como miniatura cuando viene', async () => {
    const { ingest, service } = montar({});
    vi.spyOn(service, 'createItem').mockResolvedValue({ id: 'nuevo-1', name: 'Mousepad' } as never);
    const subir = vi.spyOn(service, 'uploadAttachment').mockResolvedValue({} as never);

    await ingest.confirmar([
      {
        nombre: 'Mousepad',
        ubicacionPath: 'Homie > Cuarto Oficina > Estante Grande > Nicho 1',
        imagen: IMAGEN,
      },
    ]);

    expect(subir).toHaveBeenCalledWith(
      'nuevo-1',
      expect.objectContaining({ type: 'photo', primary: true })
    );
  });

  it('no crea nada si la ubicación confirmada no existe', async () => {
    const { ingest, service } = montar({});
    const crear = vi.spyOn(service, 'createItem');

    await expect(
      ingest.confirmar([{ nombre: 'Taladro', ubicacionPath: 'Homie > Garaje' }])
    ).rejects.toThrow('no existe');
    expect(crear).not.toHaveBeenCalled();
  });
});
