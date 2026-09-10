import { ItemResolverService } from '../../resolvers/item-resolver.service.js';
import { homeBoxService, HomeBoxService } from '../../homebox/homebox.service.js';
import { logger } from '../../../utils/logger.js';
import { normalizeSearchQuery } from '../../ai/query-normalizer.js';
import { z } from 'zod';
import type { Tool } from '../tool.types.js';

const findItemInputSchema = z.object({
  query: z.string().min(1, 'Query is required'),
});

export interface FindItemMatch {
  itemId: string;
  name: string;
  description?: string;
  locationId: string;
  locationName: string;
  locationPath: string;
}

export interface FindItemResult {
  found: boolean;
  ambiguous?: boolean;
  count?: number;
  matches?: FindItemMatch[];
  error?: string;
}

export class FindItemTool implements Tool {
  public name = 'find_item';
  public description =
    'Find an item by name and get its current location with full path. Use this for questions like "where is X" or "where are my keys". Returns item details and location in one call.';
  public inputSchema = findItemInputSchema;

  private itemResolver: ItemResolverService;
  private homeBoxService: HomeBoxService;

  constructor(service: HomeBoxService = homeBoxService) {
    this.homeBoxService = service;
    this.itemResolver = new ItemResolverService(service);
  }

  async execute(input: unknown): Promise<FindItemResult> {
    const parsed = findItemInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const cleanQuery = normalizeSearchQuery(parsed.data.query);
    logger.debug({ tool: this.name, query: cleanQuery }, 'Executing find_item');

    try {
      const resolution = await this.itemResolver.resolve(cleanQuery);

      if (resolution.count === 0) {
        return { found: false };
      }

      const matches = await Promise.all(
        resolution.result.map((item) => this.describe(item.id, item.name))
      );

      return {
        found: true,
        ambiguous: resolution.ambiguous,
        count: resolution.count,
        matches,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ tool: this.name, error: errorMessage }, 'find_item failed');
      return { found: false, error: errorMessage };
    }
  }

  /**
   * La ruta completa sale de /entities/{id}/path. El campo parent que trae la
   * entidad solo tiene el contenedor inmediato, sin sus ancestros.
   */
  private async describe(itemId: string, name: string): Promise<FindItemMatch> {
    const [fullItem, path] = await Promise.all([
      this.homeBoxService.getItemById(itemId),
      this.homeBoxService.getItemPath(itemId).catch(() => []),
    ]);

    const location = fullItem.parent;
    const ancestors = path.filter((segment) => segment.id !== itemId);
    const locationPath = ancestors.length
      ? ancestors.map((segment) => segment.name).join(' > ')
      : location?.name ?? 'Unknown';

    return {
      itemId,
      name,
      description: fullItem.description,
      locationId: location?.id ?? '',
      locationName: location?.name ?? 'Unknown',
      locationPath,
    };
  }
}
