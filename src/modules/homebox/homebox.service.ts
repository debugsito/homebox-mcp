import {
  HomeBoxClient,
  CreateEntityPayload,
  UpdateEntityPayload,
  EntityPathSegment,
  EntityType,
  CreateEntityTypePayload,
} from './homebox.client.js';
import type {
  HomeBoxEntitiesResponse,
  HomeBoxLocationsResponse,
  HomeBoxEntity,
} from './homebox.types.js';

export type EntityChangeListener = () => void;

export class HomeBoxService {
  private client: HomeBoxClient;
  private listeners = new Set<EntityChangeListener>();

  constructor(client: HomeBoxClient = new HomeBoxClient()) {
    this.client = client;
  }

  /** Avisa a los resolvers para que boten su cache tras una escritura. */
  onChange(listener: EntityChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  async listItems(page = 1, pageSize = 50): Promise<HomeBoxEntitiesResponse> {
    return this.client.listEntities(page, pageSize);
  }

  async listAllItems(): Promise<HomeBoxEntity[]> {
    return this.client.listAllEntities();
  }

  async getItemById(id: string): Promise<HomeBoxEntity> {
    return this.client.getEntityById(id);
  }

  async getItemPath(id: string): Promise<EntityPathSegment[]> {
    return this.client.getEntityPath(id);
  }

  async searchItems(query: string, page = 1, pageSize = 50): Promise<HomeBoxEntitiesResponse> {
    return this.client.searchEntities(query, page, pageSize);
  }

  async listLocations(withItems = false): Promise<HomeBoxLocationsResponse> {
    return this.client.listLocations(withItems);
  }

  async getLocationById(id: string): Promise<HomeBoxEntity> {
    return this.client.getEntityById(id);
  }

  async listEntityTypes(): Promise<EntityType[]> {
    return this.client.listEntityTypes();
  }

  async createEntityType(payload: CreateEntityTypePayload): Promise<EntityType> {
    return this.client.createEntityType(payload);
  }

  async createItem(payload: CreateEntityPayload): Promise<HomeBoxEntity> {
    const result = await this.client.createEntity(payload);
    this.notifyChange();
    return result;
  }

  async updateItem(itemId: string, payload: UpdateEntityPayload): Promise<HomeBoxEntity> {
    const result = await this.client.updateEntity(itemId, payload);
    this.notifyChange();
    return result;
  }

  async moveItem(itemId: string, parentId: string): Promise<HomeBoxEntity> {
    const result = await this.client.moveEntity(itemId, parentId);
    this.notifyChange();
    return result;
  }
}

/**
 * Instancia unica. Antes cada tool creaba la suya, asi que las caches de los
 * resolvers nunca se enteraban de las escrituras hechas por otra tool.
 */
export const homeBoxService = new HomeBoxService();
