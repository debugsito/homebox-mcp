import { HomeBoxService } from '../homebox/homebox.service.js';
import { logger } from '../../utils/logger.js';
import { normalizeString, matchScore } from './location-path.builder.js';
import type { ResolvedItem, ResolverResult, HomeBoxEntity } from './resolver.types.js';

export class ItemResolverService {
  private service: HomeBoxService;
  private cachedItems: HomeBoxEntity[] | null = null;
  private cacheTime = 0;
  private readonly CACHE_TTL_MS = 60_000; // 1 minute cache

  constructor() {
    this.service = new HomeBoxService();
  }

  private async getItems(): Promise<HomeBoxEntity[]> {
    const now = Date.now();
    if (this.cachedItems && (now - this.cacheTime) < this.CACHE_TTL_MS) {
      return this.cachedItems;
    }

    // Fetch a reasonable number of items
    const result = await this.service.listItems(1, 200);
    this.cachedItems = result.items;
    this.cacheTime = now;
    logger.debug({ count: this.cachedItems.length }, 'Items fetched and cached');
    return this.cachedItems;
  }

  async resolve(query: string): Promise<ResolverResult<ResolvedItem>> {
    const start = Date.now();
    const normalizedQuery = normalizeString(query);

    logger.info({ query, normalizedQuery }, 'Resolving item');

    const items = await this.getItems();

    const matches: Array<{ item: HomeBoxEntity; score: number }> = [];

    for (const item of items) {
      const nameNorm = normalizeString(item.name);

      if (nameNorm.includes(normalizedQuery)) {
        const score = matchScore(normalizedQuery, nameNorm);
        matches.push({ item, score });
      }

      // Also check description if present
      if (item.description) {
        const descNorm = normalizeString(item.description);
        if (descNorm.includes(normalizedQuery)) {
          matches.push({ item, score: 10 }); // Lower score for description match
        }
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    // Remove duplicates (same id) keeping highest score
    const seen = new Set<string>();
    const resolved: ResolvedItem[] = [];
    for (const { item } of matches) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        resolved.push({
          id: item.id,
          name: item.name,
          normalizedName: normalizeString(item.name),
        });
      }
    }

    const duration = Date.now() - start;
    const ambiguous = resolved.length > 1;
    const resolvedFlag = resolved.length === 1;

    logger.info({
      query,
      normalizedQuery,
      matchCount: resolved.length,
      duration,
      ambiguous,
    }, 'Item resolution complete');

    return {
      resolved: resolvedFlag,
      ambiguous,
      count: resolved.length,
      result: resolved,
      query,
      normalizedQuery,
    };
  }

  invalidateCache(): void {
    this.cachedItems = null;
    this.cacheTime = 0;
  }
}
