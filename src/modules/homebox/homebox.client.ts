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
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
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
