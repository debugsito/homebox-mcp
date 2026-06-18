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

export interface UpdateEntityPayload {
  parentId?: string | null;
  quantity?: number;
  entityTypeId?: string;
  tagIds?: string[];
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

      const data = await response.json() as T;
      logger.info({ endpoint, response: data }, 'HomeBoxClient raw response');
      return data;
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

  async createEntity(payload: CreateEntityPayload): Promise<HomeBoxEntity> {
    logger.info({ endpoint: '/api/v1/entities', payload }, 'Creating entity');
    return this.request<HomeBoxEntity>('/api/v1/entities', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateEntity(id: string, payload: UpdateEntityPayload): Promise<HomeBoxEntity> {
    logger.info({ endpoint: `/api/v1/entities/${id}`, payload }, 'Updating entity');
    return this.request<HomeBoxEntity>(`/api/v1/entities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async moveEntity(itemId: string, parentId: string): Promise<HomeBoxEntity> {
    logger.info({ endpoint: `/api/v1/entities/${itemId}`, parentId }, 'Moving entity');
    return this.request<HomeBoxEntity>(`/api/v1/entities/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ parentId }),
    });
  }
}
