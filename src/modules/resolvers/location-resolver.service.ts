import { HomeBoxService } from '../homebox/homebox.service.js';
import { logger } from '../../utils/logger.js';
import {
  buildLocationPaths,
  normalizeString,
  matchesQuery,
  matchScore,
} from './location-path.builder.js';
import type {
  ResolvedLocation,
  ResolverResult,
  LocationTreeNode,
} from './resolver.types.js';

export class LocationResolverService {
  private service: HomeBoxService;
  private cachedLocations: ResolvedLocation[] | null = null;
  private cacheTime = 0;
  private readonly CACHE_TTL_MS = 60_000; // 1 minute cache

  constructor() {
    this.service = new HomeBoxService();
  }

  private async getLocations(): Promise<ResolvedLocation[]> {
    const now = Date.now();
    if (this.cachedLocations && (now - this.cacheTime) < this.CACHE_TTL_MS) {
      return this.cachedLocations;
    }

    const tree = await this.service.listLocations(false);
    this.cachedLocations = buildLocationPaths(tree as LocationTreeNode[]);
    this.cacheTime = now;
    logger.debug({ count: this.cachedLocations.length }, 'Location paths built and cached');
    return this.cachedLocations;
  }

  async resolve(query: string): Promise<ResolverResult<ResolvedLocation>> {
    const start = Date.now();
    const normalizedQuery = normalizeString(query);

    logger.info({ query, normalizedQuery }, 'Resolving location');

    const locations = await this.getLocations();

    // Find all matches
    const matches: Array<{ location: ResolvedLocation; score: number }> = [];

    for (const location of locations) {
      // Match against name
      const nameNorm = normalizeString(location.name);
      const pathNorm = location.normalizedPath;

      if (matchesQuery(normalizedQuery, nameNorm) || matchesQuery(normalizedQuery, pathNorm)) {
        const score = matchScore(normalizedQuery, nameNorm) + matchScore(normalizedQuery, pathNorm);
        matches.push({ location, score });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    // Remove duplicates (same id) keeping highest score
    const seen = new Set<string>();
    const unique: ResolvedLocation[] = [];
    for (const { location } of matches) {
      if (!seen.has(location.id)) {
        seen.add(location.id);
        unique.push(location);
      }
    }

    const duration = Date.now() - start;
    const ambiguous = unique.length > 1;
    const resolved = unique.length === 1;

    logger.info({
      query,
      normalizedQuery,
      matchCount: unique.length,
      duration,
      ambiguous,
    }, 'Location resolution complete');

    return {
      resolved,
      ambiguous,
      count: unique.length,
      result: unique,
      query,
      normalizedQuery,
    };
  }

  invalidateCache(): void {
    this.cachedLocations = null;
    this.cacheTime = 0;
  }
}
