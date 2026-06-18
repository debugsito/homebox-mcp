import type { HomeBoxEntitiesResponse, HomeBoxLocationsResponse, HomeBoxEntity } from './homebox.types.js';
export declare class HomeBoxClient {
    private baseUrl;
    private apiKey;
    constructor();
    private request;
    listEntities(page?: number, pageSize?: number): Promise<HomeBoxEntitiesResponse>;
    getEntityById(id: string): Promise<HomeBoxEntity>;
    searchEntities(query: string, page?: number, pageSize?: number): Promise<HomeBoxEntitiesResponse>;
    listLocations(withItems?: boolean): Promise<HomeBoxLocationsResponse>;
    getLocationById(id: string): Promise<HomeBoxEntity>;
}
//# sourceMappingURL=homebox.client.d.ts.map