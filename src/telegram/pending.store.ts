import type { Propuesta } from '../modules/ingest/photo-ingest.service.js';
import type { ImagePart } from '../modules/ai/providers/gemini.provider.js';

export interface Pendiente {
  propuesta: Propuesta;
  imagen: ImagePart;
  creadoEn: number;
}

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRADAS = 50;

/**
 * Guarda la propuesta entre que se manda la foto y se pulsa el boton. Vive en
 * memoria a proposito: es estado efimero de una conversacion, y las imagenes
 * en base64 no deben acumularse en disco.
 */
export class PendingStore {
  private items = new Map<string, Pendiente>();
  private contador = 0;

  guardar(pendiente: Omit<Pendiente, 'creadoEn'>, ahora = Date.now()): string {
    this.limpiar(ahora);

    // Los ids van en el callback_data de Telegram, limitado a 64 bytes.
    const id = `p${(this.contador++).toString(36)}`;
    this.items.set(id, { ...pendiente, creadoEn: ahora });

    if (this.items.size > MAX_ENTRADAS) {
      const masViejo = [...this.items.entries()].sort(
        (a, b) => a[1].creadoEn - b[1].creadoEn
      )[0];
      this.items.delete(masViejo[0]);
    }

    return id;
  }

  obtener(id: string, ahora = Date.now()): Pendiente | undefined {
    this.limpiar(ahora);
    return this.items.get(id);
  }

  borrar(id: string): void {
    this.items.delete(id);
  }

  get tamano(): number {
    return this.items.size;
  }

  private limpiar(ahora: number): void {
    for (const [id, item] of this.items) {
      if (ahora - item.creadoEn > TTL_MS) {
        this.items.delete(id);
      }
    }
  }
}
