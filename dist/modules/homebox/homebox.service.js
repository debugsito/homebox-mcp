import { HomeBoxClient } from './homebox.client.js';
export class HomeBoxService {
    client;
    constructor() {
        this.client = new HomeBoxClient();
    }
    async listItems(page = 1, pageSize = 50) {
        return this.client.listEntities(page, pageSize);
    }
    async getItemById(id) {
        return this.client.getEntityById(id);
    }
    async searchItems(query, page = 1, pageSize = 50) {
        return this.client.searchEntities(query, page, pageSize);
    }
    async listLocations(withItems = false) {
        return this.client.listLocations(withItems);
    }
    async getLocationById(id) {
        return this.client.getLocationById(id);
    }
}
//# sourceMappingURL=homebox.service.js.map