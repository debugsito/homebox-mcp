import { GeminiProvider, type ImagePart } from '../ai/providers/gemini.provider.js';
import { homeBoxService, HomeBoxService } from '../homebox/homebox.service.js';
import { buildLocationPaths } from '../resolvers/location-path.builder.js';
import type { LocationTreeNode } from '../resolvers/resolver.types.js';
import { logger } from '../../utils/logger.js';

export interface ObjetoPropuesto {
  nombre: string;
  descripcion: string;
  tipo: string;
  cantidad: number;
  ubicacionSugerida: string;
  motivoUbicacion: string;
  confianza: 'alta' | 'media' | 'baja';
}

export interface Propuesta {
  objetos: ObjetoPropuesto[];
  notas: string;
}

export interface ObjetoConfirmado {
  nombre: string;
  descripcion?: string;
  cantidad?: number;
  ubicacionPath: string;
  imagen?: ImagePart;
}

const ESQUEMA_PROPUESTA = {
  type: 'object',
  properties: {
    objetos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          descripcion: { type: 'string' },
          tipo: { type: 'string' },
          cantidad: { type: 'integer' },
          ubicacionSugerida: { type: 'string' },
          motivoUbicacion: { type: 'string' },
          confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
        },
        required: [
          'nombre',
          'descripcion',
          'tipo',
          'cantidad',
          'ubicacionSugerida',
          'motivoUbicacion',
          'confianza',
        ],
      },
    },
    notas: { type: 'string' },
  },
  required: ['objetos', 'notas'],
};

/**
 * Analiza fotos y propone qué registrar y dónde. No escribe nada por su
 * cuenta: el LLM propone, una persona confirma y solo entonces se guarda.
 */
export class PhotoIngestService {
  private provider: GeminiProvider;
  private service: HomeBoxService;

  constructor(service: HomeBoxService = homeBoxService, provider = new GeminiProvider()) {
    this.service = service;
    this.provider = provider;
  }

  async analizar(images: ImagePart[], pista?: string): Promise<Propuesta> {
    if (images.length === 0) {
      throw new Error('No se recibió ninguna imagen');
    }

    const ubicaciones = await this.rutasDisponibles();
    const propuesta = await this.provider.extractFromImages<Propuesta>(
      this.prompt(ubicaciones, pista),
      images,
      ESQUEMA_PROPUESTA
    );

    // El modelo puede inventarse una ruta; solo valen las que existen.
    const validas = new Set(ubicaciones);
    for (const objeto of propuesta.objetos ?? []) {
      if (!validas.has(objeto.ubicacionSugerida)) {
        logger.warn(
          { sugerida: objeto.ubicacionSugerida, objeto: objeto.nombre },
          'Ubicación inventada por el modelo, se descarta'
        );
        objeto.ubicacionSugerida = '';
        objeto.motivoUbicacion = 'Sin ubicación válida propuesta, hay que elegirla a mano.';
        objeto.confianza = 'baja';
      }
    }

    logger.info(
      { objetos: propuesta.objetos?.length ?? 0, imagenes: images.length },
      'Propuesta de inventario generada'
    );
    return propuesta;
  }

  /** Escribe en HomeBox lo que la persona ya confirmó. */
  async confirmar(objetos: ObjetoConfirmado[]): Promise<{ id: string; nombre: string }[]> {
    const ubicaciones = await this.mapaDeRutas();
    const creados: { id: string; nombre: string }[] = [];

    for (const objeto of objetos) {
      const parentId = ubicaciones.get(objeto.ubicacionPath);
      if (!parentId) {
        throw new Error(`La ubicación "${objeto.ubicacionPath}" no existe`);
      }

      const entidad = await this.service.createItem({
        name: objeto.nombre,
        description: objeto.descripcion,
        parentId,
        quantity: objeto.cantidad,
      });

      if (objeto.imagen) {
        await this.service.uploadAttachment(entidad.id, {
          file: new Uint8Array(Buffer.from(objeto.imagen.data, 'base64')),
          filename: `${objeto.nombre}.${objeto.imagen.mimeType.split('/')[1]}`,
          mimeType: objeto.imagen.mimeType,
          type: 'photo',
          primary: true,
          title: objeto.nombre,
        });
      }

      creados.push({ id: entidad.id, nombre: entidad.name });
    }

    return creados;
  }

  private async mapaDeRutas(): Promise<Map<string, string>> {
    const tree = await this.service.listLocations(false);
    return new Map(buildLocationPaths(tree as LocationTreeNode[]).map((l) => [l.path, l.id]));
  }

  private async rutasDisponibles(): Promise<string[]> {
    return [...(await this.mapaDeRutas()).keys()];
  }

  private prompt(ubicaciones: string[], pista?: string): string {
    return `Eres un asistente que inventaria objetos de una casa a partir de fotos.

Identifica los objetos que se ven en la imagen y, para cada uno, propón dónde guardarlo.

## Ubicaciones existentes
${ubicaciones.map((u) => `- ${u}`).join('\n')}

## Reglas
1. "ubicacionSugerida" tiene que ser EXACTAMENTE una de las rutas de arriba, copiada tal cual.
   Si ninguna encaja, déjala vacía y explica por qué en "motivoUbicacion".
2. Agrupa lo que sea del mismo tipo en un solo objeto con la cantidad correspondiente
   (seis tornillos iguales son un objeto con cantidad 6, no seis objetos).
3. El nombre debe ser específico y buscable: incluye marca, modelo o medida si se leen en la
   foto. "Extensor HDMI via UTP" sirve; "cable" no.
4. La descripción, una frase: para qué es o qué lo distingue de otros parecidos.
5. Propón la ubicación por afinidad con lo que ya vive ahí y por tamaño. Explica el criterio
   en "motivoUbicacion", en una frase.
6. Usa confianza "baja" si no distingues bien el objeto o dudas de la ubicación. Es preferible
   admitir la duda a inventarse un nombre.
7. En "notas" apunta lo que veas pero no puedas identificar, o lo que convenga fotografiar
   más de cerca.

Responde en español.${pista ? `\n\n## Contexto que da el usuario\n${pista}` : ''}`;
  }
}
