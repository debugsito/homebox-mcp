import { HomeBoxClient } from './homebox.client.js';
import { logger } from '../../utils/logger.js';
export class HomeBoxService {
    client;
    constructor() {
        this.client = new HomeBoxClient();
    }
    async listItems(page = 1, pageSize = 50) {
        const result = await this.client.listEntities(page, pageSize);
        logger.info({ result }, 'HomeBoxService.listItems returning');
        return result;
    }
    async getItemById(id) {
        const result = await this.client.getEntityById(id);
        logger.info({ result }, 'HomeBoxService.getItemById returning');
        return result;
    }
    async searchItems(query, page = 1, pageSize = 50) {
        const result = await this.client.searchEntities(query, page, pageSize);
        logger.info({ result }, 'HomeBoxService.searchItems returning');
        return result;
    }
    async listLocations(withItems = false) {
        const result = await this.client.listLocations(withItems);
        logger.info({ result }, 'HomeBoxService.listLocations returning');
        return result;
    }
    async getLocationById(id) {
        const result = await this.client.getEntityById(id);
        logger.info({ result }, 'HomeBoxService.getLocationById returning');
        return result;
    }
    async createItem(payload) {
        const result = await this.client.createEntity(payload);
        logger.info({ item: result.name, parentId: payload.parentId }, 'HomeBoxService.createItem');
        return result;
    }
    async updateItem(itemId, payload) {
        const result = await this.client.updateEntity(itemId, payload);
        logger.info({ itemId, updates: payload }, 'HomeBoxService.updateItem');
        return result;
    }
    async moveItem(itemId, parentId) {
        const result = await this.client.moveEntity(itemId, parentId);
        logger.info({ itemId, parentId }, 'HomeBoxService.moveItem');
        return result;
    }
}
//# sourceMappingURL=homebox.service.js.map