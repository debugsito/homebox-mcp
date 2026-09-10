import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type {
  HomeBoxEntitiesResponse,
  HomeBoxLocationsResponse,
  HomeBoxEntity,
} from './homebox.types.js';

export interface CreateEntityPayload {
  name: string;
  description?: string;
  parentId?: string;
  quantity?: number;
  entityTypeId?: string;
  tagIds?: string[];
}

/** Campos que acepta PATCH /entities/{id} (repo.EntityPatch). */
export interface PatchEntityPayload {
  parentId?: string | null;
  quantity?: number;
  entityTypeId?: string;
  tagIds?: string[];
}

/**
 * Campos que acepta PUT /entities/{id} (repo.EntityUpdate). PATCH ignora en
 * silencio name y description, asi que renombrar obliga a pasar por PUT.
 */
export interface UpdateEntityPayload extends PatchEntityPayload {
  name?: string;
  description?: string;
}

export interface EntityPathSegment {
  id: string;
  name: string;
  type: string;
}

export interface EntityType {
  id: string;
  name: string;
  isLocation: boolean;
  icon?: string;
  description?: string;
}

export interface CreateEntityTypePayload {
  name: string;
  isLocation: boolean;
  icon?: string;
}

export type AttachmentType = 'photo' | 'manual' | 'warranty' | 'attachment' | 'receipt';

export interface UploadAttachmentPayload {
  file: Uint8Array;
  filename: string;
  mimeType: string;
  /** `photo` marcada como primary es la que HomeBox usa de miniatura. */
  type?: AttachmentType;
  primary?: boolean;
  title?: string;
}

export interface EntityAttachment {
  id: string;
  title: string;
  type: string;
  mimeType: string;
  primary: boolean;
  path?: string;
  createdAt?: string;
}

export class HomeBoxClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.HOMEBOX_URL;
    this.apiKey = config.HOMEBOX_API_KEY;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const start = Date.now();

    try {
      // Con FormData hay que dejar que fetch ponga el boundary del multipart;
      // fijar Content-Type a mano rompe la subida.
      const esMultipart = options.body instanceof FormData;

      const response = await fetch(url, {
        ...options,
        headers: {
          ...(esMultipart ? {} : { 'Content-Type': 'application/json' }),
          Authorization: `Bearer ${this.apiKey}`,
          ...options.headers,
        },
      });

      const duration = Date.now() - start;
      logger.debug({ endpoint, duration, status: response.status }, 'HomeBox API request');

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error({ endpoint, status: response.status, error: errorBody }, 'HomeBox API error');
        throw new Error(`HomeBox API error: ${response.status}`);
      }

      // Un 204 no trae cuerpo y response.json() reventaria.
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return undefined as T;
      }

      return await response.json() as T;
    } catch (err) {
      const duration = Date.now() - start;
      logger.error({ endpoint, duration, error: err }, 'HomeBox request failed');
      throw err;
    }
  }

  async listEntities(page = 1, pageSize = 50): Promise<HomeBoxEntitiesResponse> {
    return this.request<HomeBoxEntitiesResponse>(
      `/api/v1/entities?page=${page}&pageSize=${pageSize}`
    );
  }

  async getEntityById(id: string): Promise<HomeBoxEntity> {
    return this.request<HomeBoxEntity>(`/api/v1/entities/${id}`);
  }

  async searchEntities(query: string, page = 1, pageSize = 50): Promise<HomeBoxEntitiesResponse> {
    const q = encodeURIComponent(query);
    return this.request<HomeBoxEntitiesResponse>(
      `/api/v1/entities?q=${q}&page=${page}&pageSize=${pageSize}`
    );
  }

  async listLocations(withItems = false): Promise<HomeBoxLocationsResponse> {
    return this.request<HomeBoxLocationsResponse>(
      `/api/v1/entities/tree?withItems=${withItems}`
    );
  }

  /** Recorre todas las paginas. El inventario cabe de sobra en memoria. */
  async listAllEntities(pageSize = 200): Promise<HomeBoxEntity[]> {
    const all: HomeBoxEntity[] = [];

    for (let page = 1; ; page++) {
      const batch = await this.listEntities(page, pageSize);
      all.push(...batch.items);

      if (batch.items.length < pageSize || all.length >= batch.total) {
        return all;
      }
    }
  }

  async createEntity(payload: CreateEntityPayload): Promise<HomeBoxEntity> {
    logger.debug({ name: payload.name, parentId: payload.parentId }, 'Creating entity');
    return this.request<HomeBoxEntity>('/api/v1/entities', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** Cadena de ancestros, de la raiz hasta la propia entidad. */
  async getEntityPath(id: string): Promise<EntityPathSegment[]> {
    return this.request<EntityPathSegment[]>(`/api/v1/entities/${id}/path`);
  }

  /**
   * Sube un adjunto. Una `photo` marcada como primary pasa a ser la miniatura
   * de la ficha, que es lo que se quiere al inventariar desde una foto.
   */
  async uploadAttachment(
    entityId: string,
    payload: UploadAttachmentPayload
  ): Promise<EntityAttachment> {
    const form = new FormData();
    const blob = new Blob([payload.file], { type: payload.mimeType });

    form.append('file', blob, payload.filename);
    form.append('type', payload.type ?? 'photo');
    form.append('primary', String(payload.primary ?? false));
    form.append('name', payload.title ?? payload.filename);

    logger.debug(
      { entityId, bytes: payload.file.byteLength, mimeType: payload.mimeType },
      'Uploading attachment'
    );

    // El endpoint responde 201 con la entidad entera, no con el adjunto, asi
    // que hay que sacarlo de su lista.
    const entity = await this.request<HomeBoxEntity>(
      `/api/v1/entities/${entityId}/attachments`,
      { method: 'POST', body: form }
    );

    const adjunto = nuevoAdjunto(entity.attachments, payload.title ?? payload.filename);
    if (!adjunto) {
      throw new Error('HomeBox aceptó la subida pero no devolvió el adjunto');
    }

    return adjunto;
  }

  async deleteAttachment(entityId: string, attachmentId: string): Promise<void> {
    await this.request<unknown>(`/api/v1/entities/${entityId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  }

  /** Los tipos separan ubicaciones de objetos mediante isLocation. */
  async listEntityTypes(): Promise<EntityType[]> {
    return this.request<EntityType[]>('/api/v1/entity-types');
  }

  async createEntityType(payload: CreateEntityTypePayload): Promise<EntityType> {
    logger.debug({ name: payload.name, isLocation: payload.isLocation }, 'Creating entity type');
    return this.request<EntityType>('/api/v1/entity-types', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async patchEntity(id: string, payload: PatchEntityPayload): Promise<HomeBoxEntity> {
    logger.debug({ entityId: id, fields: Object.keys(payload) }, 'Patching entity');
    return this.request<HomeBoxEntity>(`/api/v1/entities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  /**
   * PUT reemplaza la entidad entera, asi que primero se lee la actual y se
   * fusionan los campos pedidos. Es el unico camino para name y description.
   */
  async updateEntity(id: string, payload: UpdateEntityPayload): Promise<HomeBoxEntity> {
    const { name, description, ...patchable } = payload;

    if (name === undefined && description === undefined) {
      return this.patchEntity(id, patchable);
    }

    const current = await this.getEntityById(id);
    const merged = {
      ...current,
      ...patchable,
      id,
      name: name ?? current.name,
      description: description ?? current.description,
      parentId: patchable.parentId !== undefined ? patchable.parentId : current.parent?.id ?? null,
      entityTypeId: patchable.entityTypeId ?? current.entityType?.id,
    };

    logger.debug({ entityId: id, fields: Object.keys(payload) }, 'Updating entity via PUT');
    return this.request<HomeBoxEntity>(`/api/v1/entities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(merged),
    });
  }

  async moveEntity(itemId: string, parentId: string): Promise<HomeBoxEntity> {
    logger.debug({ entityId: itemId, parentId }, 'Moving entity');
    return this.patchEntity(itemId, { parentId });
  }
}

/**
 * Identifica el adjunto recien subido dentro de la entidad que devuelve el
 * POST. Prefiere el que coincide por titulo; si hay varios, el mas reciente.
 */
function nuevoAdjunto(
  attachments: EntityAttachment[] | undefined,
  titulo: string
): EntityAttachment | undefined {
  const lista = attachments ?? [];
  if (lista.length === 0) {
    return undefined;
  }

  const porTitulo = lista.filter((a) => a.title === titulo);
  const candidatos = porTitulo.length > 0 ? porTitulo : lista;

  return candidatos.reduce((mejor, actual) =>
    (actual.createdAt ?? '') >= (mejor.createdAt ?? '') ? actual : mejor
  );
}
