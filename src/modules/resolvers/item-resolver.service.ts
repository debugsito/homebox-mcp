import { homeBoxService, HomeBoxService } from '../homebox/homebox.service.js';
import { logger } from '../../utils/logger.js';
import { normalizeString, matchScore } from './location-path.builder.js';
import type { ResolvedItem, ResolverResult, HomeBoxEntity } from './resolver.types.js';

const DESCRIPTION_MATCH_SCORE = 10;

export class ItemResolverService {
  private service: HomeBoxService;
  private cachedItems: HomeBoxEntity[] | null = null;
  private cacheTime = 0;
  private readonly CACHE_TTL_MS = 60_000;

  constructor(service: HomeBoxService = homeBoxService) {
    this.service = service;
    this.service.onChange(() => this.invalidateCache());
  }

  private async getItems(): Promise<HomeBoxEntity[]> {
    const now = Date.now();
    if (this.cachedItems && now - this.cacheTime < this.CACHE_TTL_MS) {
      return this.cachedItems;
    }

    // Paginado completo: con un tope fijo los items sobrantes eran invisibles.
    this.cachedItems = (await this.service.listAllItems()) as HomeBoxEntity[];
    this.cacheTime = now;
    logger.debug({ count: this.cachedItems.length }, 'Items fetched and cached');
    return this.cachedItems;
  }

  async resolve(query: string): Promise<ResolverResult<ResolvedItem>> {
    const start = Date.now();
    const normalizedQuery = normalizeString(query);
    const items = await this.getItems();

    // Un item puede matchear por nombre y por descripcion; nos quedamos con el
    // mejor score en vez de encolarlo dos veces.
    const best = new Map<string, { item: HomeBoxEntity; score: number }>();

    const consider = (item: HomeBoxEntity, score: number) => {
      const previous = best.get(item.id);
      if (!previous || score > previous.score) {
        best.set(item.id, { item, score });
      }
    };

    for (const item of items) {
      const nameNorm = normalizeString(item.name);
      if (nameNorm.includes(normalizedQuery)) {
        consider(item, matchScore(normalizedQuery, nameNorm));
      }

      if (item.description) {
        const descNorm = normalizeString(item.description);
        if (descNorm.includes(normalizedQuery)) {
          consider(item, DESCRIPTION_MATCH_SCORE);
        }
      }
    }

    const resolved: ResolvedItem[] = [...best.values()]
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => ({
        id: item.id,
        name: item.name,
        normalizedName: normalizeString(item.name),
      }));

    logger.debug(
      { query, matchCount: resolved.length, duration: Date.now() - start },
      'Item resolution complete'
    );

    return {
      resolved: resolved.length === 1,
      ambiguous: resolved.length > 1,
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
