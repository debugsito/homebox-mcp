import { CreateEntityPayload, UpdateEntityPayload } from './homebox.client.js';
import type { HomeBoxEntitiesResponse, HomeBoxLocationsResponse, HomeBoxEntity } from './homebox.types.js';
export declare class HomeBoxService {
    private client;
    constructor();
    listItems(page?: number, pageSize?: number): Promise<HomeBoxEntitiesResponse>;
    getItemById(id: string): Promise<HomeBoxEntity>;
    searchItems(query: string, page?: number, pageSize?: number): Promise<HomeBoxEntitiesResponse>;
    listLocations(withItems?: boolean): Promise<HomeBoxLocationsResponse>;
    getLocationById(id: string): Promise<HomeBoxEntity>;
    createItem(payload: CreateEntityPayload): Promise<HomeBoxEntity>;
    updateItem(itemId: string, payload: UpdateEntityPayload): Promise<HomeBoxEntity>;
    moveItem(itemId: string, parentId: string): Promise<HomeBoxEntity>;
}
//# sourceMappingURL=homebox.service.d.ts.map