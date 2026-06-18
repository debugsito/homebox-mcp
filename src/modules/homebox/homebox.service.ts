import { HomeBoxClient, CreateEntityPayload, UpdateEntityPayload } from './homebox.client.js';
import { logger } from '../../utils/logger.js';
import type {
  HomeBoxEntitiesResponse,
  HomeBoxLocationsResponse,
  HomeBoxEntity,
} from './homebox.types.js';

export class HomeBoxService {
  private client: HomeBoxClient;

  constructor() {
    this.client = new HomeBoxClient();
  }

  async listItems(page = 1, pageSize = 50): Promise<HomeBoxEntitiesResponse> {
    const result = await this.client.listEntities(page, pageSize);
    logger.info({ result }, 'HomeBoxService.listItems returning');
    return result;
  }

  async getItemById(id: string): Promise<HomeBoxEntity> {
    const result = await this.client.getEntityById(id);
    logger.info({ result }, 'HomeBoxService.getItemById returning');
    return result;
  }

  async searchItems(query: string, page = 1, pageSize = 50): Promise<HomeBoxEntitiesResponse> {
    const result = await this.client.searchEntities(query, page, pageSize);
    logger.info({ result }, 'HomeBoxService.searchItems returning');
    return result;
  }

  async listLocations(withItems = false): Promise<HomeBoxLocationsResponse> {
    const result = await this.client.listLocations(withItems);
    logger.info({ result }, 'HomeBoxService.listLocations returning');
    return result;
  }

  async getLocationById(id: string): Promise<HomeBoxEntity> {
    const result = await this.client.getEntityById(id);
    logger.info({ result }, 'HomeBoxService.getLocationById returning');
    return result;
  }

  async createItem(payload: CreateEntityPayload): Promise<HomeBoxEntity> {
    const result = await this.client.createEntity(payload);
    logger.info({ item: result.name, parentId: payload.parentId }, 'HomeBoxService.createItem');
    return result;
  }

  async updateItem(itemId: string, payload: UpdateEntityPayload): Promise<HomeBoxEntity> {
    const result = await this.client.updateEntity(itemId, payload);
    logger.info({ itemId, updates: payload }, 'HomeBoxService.updateItem');
    return result;
  }

  async moveItem(itemId: string, parentId: string): Promise<HomeBoxEntity> {
    const result = await this.client.moveEntity(itemId, parentId);
    logger.info({ itemId, parentId }, 'HomeBoxService.moveItem');
    return result;
  }
}
