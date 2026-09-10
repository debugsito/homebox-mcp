import { describe, it, expect } from 'vitest';
import { PendingStore } from '../src/telegram/pending.store.js';
import { formatearPropuesta } from '../src/telegram/bot.js';

const IMAGEN = { data: 'AAAA', mimeType: 'image/jpeg' };
const PROPUESTA = { objetos: [], notas: '' };

describe('PendingStore', () => {
  it('devuelve lo guardado por su id', () => {
    const store = new PendingStore();
    const id = store.guardar({ propuesta: PROPUESTA, imagen: IMAGEN });

    expect(store.obtener(id)?.imagen).toEqual(IMAGEN);
  });

  it('genera ids que caben en el callback_data de Telegram (64 bytes)', () => {
    const store = new PendingStore();

    for (let i = 0; i < 500; i++) {
      const id = store.guardar({ propuesta: PROPUESTA, imagen: IMAGEN });
      expect(Buffer.byteLength(`ok:${id}`)).toBeLessThan(64);
    }
  });

  it('caduca lo que pasa de media hora', () => {
    const store = new PendingStore();
    const t0 = 1_000_000;
    const id = store.guardar({ propuesta: PROPUESTA, imagen: IMAGEN }, t0);

    expect(store.obtener(id, t0 + 29 * 60_000)).toBeDefined();
    expect(store.obtener(id, t0 + 31 * 60_000)).toBeUndefined();
  });

  it('no crece sin límite: las imágenes en base64 ocupan', () => {
    const store = new PendingStore();

    for (let i = 0; i < 120; i++) {
      store.guardar({ propuesta: PROPUESTA, imagen: IMAGEN });
    }

    expect(store.tamano).toBeLessThanOrEqual(50);
  });

  it('borrar deja de devolverlo', () => {
    const store = new PendingStore();
    const id = store.guardar({ propuesta: PROPUESTA, imagen: IMAGEN });

    store.borrar(id);

    expect(store.obtener(id)).toBeUndefined();
  });
});

describe('formatearPropuesta', () => {
  const objeto = {
    nombre: 'Extensor HDMI via UTP',
    descripcion: 'extiende HDMI por cable de red',
    cantidad: 1,
    ubicacionSugerida: 'Homie > Cuarto Oficina > Escritorio > Cajón 1',
    motivoUbicacion: 'ahí están los cables de vídeo',
    confianza: 'alta',
  };

  it('muestra nombre, descripción, destino y motivo', () => {
    const texto = formatearPropuesta({ objetos: [objeto], notas: '' });

    expect(texto).toContain('Extensor HDMI via UTP');
    expect(texto).toContain('extiende HDMI por cable de red');
    expect(texto).toContain('Homie > Cuarto Oficina > Escritorio > Cajón 1');
    expect(texto).toContain('ahí están los cables de vídeo');
  });

  it('marca la cantidad solo cuando hay más de uno', () => {
    expect(formatearPropuesta({ objetos: [objeto], notas: '' })).not.toContain('×');
    expect(
      formatearPropuesta({ objetos: [{ ...objeto, cantidad: 6 }], notas: '' })
    ).toContain('×6');
  });

  it('distingue la confianza con una marca', () => {
    const alta = formatearPropuesta({ objetos: [objeto], notas: '' });
    const baja = formatearPropuesta({ objetos: [{ ...objeto, confianza: 'baja' }], notas: '' });

    expect(alta.startsWith('✓')).toBe(true);
    expect(baja.startsWith('?')).toBe(true);
  });

  it('dice explícitamente cuando no hay ubicación clara', () => {
    const texto = formatearPropuesta({
      objetos: [{ ...objeto, ubicacionSugerida: '', motivoUbicacion: 'ninguna encaja' }],
      notas: '',
    });

    expect(texto).toContain('sin ubicación clara');
  });

  it('añade las notas al final si las hay', () => {
    expect(formatearPropuesta({ objetos: [objeto], notas: 'hay algo borroso al fondo' })).toContain(
      'Notas: hay algo borroso al fondo'
    );
  });
});
