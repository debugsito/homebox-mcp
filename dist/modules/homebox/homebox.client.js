import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
export class HomeBoxClient {
    baseUrl;
    apiKey;
    constructor() {
        this.baseUrl = config.HOMEBOX_URL;
        this.apiKey = config.HOMEBOX_API_KEY;
    }
    async request(endpoint, options = {}) {
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
            const data = await response.json();
            return data;
        }
        catch (err) {
            const duration = Date.now() - start;
            logger.error({ endpoint, duration, error: err }, 'HomeBox request failed');
            throw err;
        }
    }
    async listEntities(page = 1, pageSize = 50) {
        return this.request(`/api/v1/entities?page=${page}&pageSize=${pageSize}`);
    }
    async getEntityById(id) {
        return this.request(`/api/v1/entities/${id}`);
    }
    async searchEntities(query, page = 1, pageSize = 50) {
        const q = encodeURIComponent(query);
        return this.request(`/api/v1/entities?q=${q}&page=${page}&pageSize=${pageSize}`);
    }
    async listLocations(withItems = false) {
        return this.request(`/api/v1/entities/tree?withItems=${withItems}`);
    }
    async getLocationById(id) {
        return this.request(`/api/v1/entities/${id}`);
    }
}
//# sourceMappingURL=homebox.client.js.map