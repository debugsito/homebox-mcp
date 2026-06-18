import { HomeBoxClient } from './homebox.client.js';
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
    return this.client.listEntities(page, pageSize);
  }

  async getItemById(id: string): Promise<HomeBoxEntity> {
    return this.client.getEntityById(id);
  }

  async searchItems(query: string, page = 1, pageSize = 50): Promise<HomeBoxEntitiesResponse> {
    return this.client.searchEntities(query, page, pageSize);
  }

  async listLocations(withItems = false): Promise<HomeBoxLocationsResponse> {
    return this.client.listLocations(withItems);
  }

  async getLocationById(id: string): Promise<HomeBoxEntity> {
    return this.client.getLocationById(id);
  }
}
