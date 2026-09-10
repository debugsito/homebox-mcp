import { homeBoxService, HomeBoxService } from '../homebox/homebox.service.js';
import { logger } from '../../utils/logger.js';
import {
  buildLocationPaths,
  normalizeString,
  matchesQuery,
  matchScore,
} from './location-path.builder.js';
import type { ResolvedLocation, ResolverResult, LocationTreeNode } from './resolver.types.js';

export class LocationResolverService {
  private service: HomeBoxService;
  private cachedLocations: ResolvedLocation[] | null = null;
  private cacheTime = 0;
  private readonly CACHE_TTL_MS = 60_000;

  constructor(service: HomeBoxService = homeBoxService) {
    this.service = service;
    this.service.onChange(() => this.invalidateCache());
  }

  private async getLocations(): Promise<ResolvedLocation[]> {
    const now = Date.now();
    if (this.cachedLocations && now - this.cacheTime < this.CACHE_TTL_MS) {
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
    const locations = await this.getLocations();

    const best = new Map<string, { location: ResolvedLocation; score: number }>();

    for (const location of locations) {
      const nameNorm = normalizeString(location.name);
      const pathNorm = location.normalizedPath;

      if (matchesQuery(normalizedQuery, nameNorm) || matchesQuery(normalizedQuery, pathNorm)) {
        const score =
          matchScore(normalizedQuery, nameNorm) + matchScore(normalizedQuery, pathNorm);
        const previous = best.get(location.id);
        if (!previous || score > previous.score) {
          best.set(location.id, { location, score });
        }
      }
    }

    const unique = [...best.values()]
      .sort((a, b) => b.score - a.score)
      .map(({ location }) => location);

    logger.debug(
      { query, matchCount: unique.length, duration: Date.now() - start },
      'Location resolution complete'
    );

    return {
      resolved: unique.length === 1,
      ambiguous: unique.length > 1,
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
