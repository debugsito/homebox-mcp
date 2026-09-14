import { logger } from '../../../utils/logger.js';
import { esReintentableEnOtro } from './provider.error.js';
import type {
  AIProvider,
  AIChatResponse,
  AIMessage,
  AIToolDefinition,
} from './ai-provider.interface.js';

export interface ProveedorNombrado {
  nombre: string;
  provider: AIProvider;
}

/**
 * Encadena varios proveedores: si el primero se queda sin cuota o esta caido,
 * prueba el siguiente. Solo pivota ante 429 y 5xx; un 400 o un 401 fallarian
 * igual en todos y recorrer la cadena solo retrasaria el error.
 */
export class FallbackProvider implements AIProvider {
  private cadena: ProveedorNombrado[];

  constructor(cadena: ProveedorNombrado[]) {
    if (cadena.length === 0) {
      throw new Error('La cadena de proveedores está vacía');
    }
    this.cadena = cadena;
  }

  get nombres(): string[] {
    return this.cadena.map((p) => p.nombre);
  }

  async chat(messages: AIMessage[]): Promise<AIChatResponse> {
    return this.intentar((p) => p.chat(messages));
  }

  async chatWithTools(
    messages: AIMessage[],
    tools: AIToolDefinition[]
  ): Promise<AIChatResponse> {
    return this.intentar((p) => p.chatWithTools(messages, tools));
  }

  private async intentar(
    llamada: (p: AIProvider) => Promise<AIChatResponse>
  ): Promise<AIChatResponse> {
    let ultimo: unknown;

    for (const [i, { nombre, provider }] of this.cadena.entries()) {
      try {
        const respuesta = await llamada(provider);
        if (i > 0) {
          logger.info({ proveedor: nombre, saltados: i }, 'Respondió un proveedor de respaldo');
        }
        return respuesta;
      } catch (err) {
        ultimo = err;
        const quedan = i < this.cadena.length - 1;

        if (!esReintentableEnOtro(err) || !quedan) {
          throw err;
        }

        logger.warn(
          { proveedor: nombre, siguiente: this.cadena[i + 1].nombre, error: mensaje(err) },
          'Proveedor no disponible, pivotando'
        );
      }
    }

    throw ultimo;
  }
}

function mensaje(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
