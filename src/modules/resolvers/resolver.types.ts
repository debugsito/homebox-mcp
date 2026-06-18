export interface ResolvedLocation {
  id: string;
  name: string;
  path: string;
  normalizedPath: string;
}

export interface ResolvedItem {
  id: string;
  name: string;
  normalizedName: string;
}

export interface ResolverResult<T> {
  resolved: boolean;
  ambiguous: boolean;
  count: number;
  result: T[];
  query: string;
  normalizedQuery: string;
}

export interface LocationTreeNode {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  children?: LocationTreeNode[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface HomeBoxEntity {
  id: string;
  name: string;
  description?: string;
  location_id?: string;
  created_at?: string;
  updated_at?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
