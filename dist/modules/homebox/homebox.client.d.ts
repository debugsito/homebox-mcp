import type { HomeBoxEntitiesResponse, HomeBoxLocationsResponse, HomeBoxEntity } from './homebox.types.js';
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
export declare class HomeBoxClient {
    private baseUrl;
    private apiKey;
    constructor();
    private request;
    listEntities(page?: number, pageSize?: number): Promise<HomeBoxEntitiesResponse>;
    getEntityById(id: string): Promise<HomeBoxEntity>;
    searchEntities(query: string, page?: number, pageSize?: number): Promise<HomeBoxEntitiesResponse>;
    listLocations(withItems?: boolean): Promise<HomeBoxLocationsResponse>;
    createEntity(payload: CreateEntityPayload): Promise<HomeBoxEntity>;
    updateEntity(id: string, payload: UpdateEntityPayload): Promise<HomeBoxEntity>;
    moveEntity(itemId: string, parentId: string): Promise<HomeBoxEntity>;
}
//# sourceMappingURL=homebox.client.d.ts.map