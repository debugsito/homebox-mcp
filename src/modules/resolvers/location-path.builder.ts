import type { LocationTreeNode, ResolvedLocation } from './resolver.types.js';

/**
 * Builds a flat list of all locations with their full paths constructed.
 */
export function buildLocationPaths(tree: LocationTreeNode[]): ResolvedLocation[] {
  const result: ResolvedLocation[] = [];

  function traverse(node: LocationTreeNode, parentPath: string[]) {
    const currentPath = [...parentPath, node.name];
    const path = currentPath.join(' > ');
    const normalizedPath = normalizeString(path);

    result.push({
      id: node.id,
      name: node.name,
      path,
      normalizedPath,
    });

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        traverse(child, currentPath);
      }
    }
  }

  for (const root of tree) {
    traverse(root, []);
  }

  return result;
}

/**
 * Normalize a string for comparison:
 * - trim whitespace
 * - lowercase
 * - remove accents
 * - collapse multiple spaces to single space
 * - replace dashes with spaces
 */
export function normalizeString(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Check if a normalized query matches a normalized target.
 * Supports partial matching (query is substring of target).
 */
export function matchesQuery(query: string, target: string): boolean {
  return target.includes(query);
}

/**
 * Calculate a match score for ranking results.
 * Higher score = better match.
 */
export function matchScore(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();

  // Exact match
  if (t === q) return 100;

  // Starts with query
  if (t.startsWith(q)) return 80;

  // Contains query as word boundary match
  const regex = new RegExp(`\\b${escapeRegex(q)}`, 'i');
  if (regex.test(t)) return 60;

  // Contains query as substring
  if (t.includes(q)) return 40;

  // All query words are present (out of order)
  const queryWords = q.split(/\s+/).filter(Boolean);
  const targetWords = t.split(/\s+/).filter(Boolean);
  const allWordsMatch = queryWords.every(qw => targetWords.some(tw => tw.includes(qw)));
  if (allWordsMatch) return 20;

  return 0;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
