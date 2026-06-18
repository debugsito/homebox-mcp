export interface HomeBoxEntity {
    id: string;
    name: string;
    description?: string;
    location_id?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}
export interface HomeBoxEntityListResult {
    data: HomeBoxEntity[];
    total: number;
    page: number;
    pageSize: number;
}
export interface HomeBoxTreeItem {
    id: string;
    name: string;
    description?: string;
    parent_id?: string;
    children?: HomeBoxTreeItem[];
    items?: HomeBoxEntity[];
    [key: string]: any;
}
export interface HomeBoxApiError {
    error: string;
    message: string;
    statusCode: number;
}
export type HomeBoxEntitiesResponse = HomeBoxEntityListResult;
export type HomeBoxLocationsResponse = HomeBoxTreeItem[];
//# sourceMappingURL=homebox.types.d.ts.map