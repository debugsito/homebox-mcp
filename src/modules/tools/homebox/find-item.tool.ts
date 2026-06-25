import { ItemResolverService } from '../../resolvers/item-resolver.service.js';
import { HomeBoxService } from '../../homebox/homebox.service.js';
import { logger } from '../../../utils/logger.js';
import { normalizeSearchQuery } from '../../ai/query-normalizer.js';
import { z } from 'zod';
import type { Tool } from '../tool.types.js';

const findItemInputSchema = z.object({
  query: z.string().min(1, 'Query is required'),
});

type FindItemInput = z.infer<typeof findItemInputSchema>;

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
  public description = 'Find an item by name and get its current location with full path. Use this for questions like "where is X" or "where are my keys". Returns item details and location in one call.';
  public inputSchema = findItemInputSchema;

  private itemResolver: ItemResolverService;
  private homeBoxService: HomeBoxService;

  constructor() {
    this.itemResolver = new ItemResolverService();
    this.homeBoxService = new HomeBoxService();
  }

  async execute(input: unknown): Promise<FindItemResult> {
    const parsed = findItemInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { query } = parsed.data as FindItemInput;
    const cleanQuery = normalizeSearchQuery(query);

    logger.info({ tool: this.name, query, cleanQuery }, 'Executing find_item');

    try {
      const resolution = await this.itemResolver.resolve(cleanQuery);

      if (!resolution.resolved && resolution.count === 0) {
        return { found: false };
      }

      if (resolution.ambiguous) {
        // Return all matches with their locations
        const matches: FindItemMatch[] = [];

        for (const item of resolution.result) {
          const fullItem = await this.homeBoxService.getItemById(item.id);
          const location = fullItem.parent;

          matches.push({
            itemId: item.id,
            name: item.name,
            description: fullItem.description,
            locationId: location?.id ?? '',
            locationName: location?.name ?? 'Unknown',
            locationPath: (location as Record<string, unknown>)?.path as string ?? location?.name ?? 'Unknown',
          });
        }

        return {
          found: true,
          ambiguous: true,
          count: resolution.count,
          matches,
        };
      }

      // Single match - get full details with location
      const item = resolution.result[0];
      const fullItem = await this.homeBoxService.getItemById(item.id);
      const location = fullItem.parent;

      return {
        found: true,
        ambiguous: false,
        count: 1,
        matches: [{
          itemId: item.id,
          name: item.name,
          description: fullItem.description,
          locationId: location?.id ?? '',
          locationName: location?.name ?? 'Unknown',
          locationPath: (location as Record<string, unknown>)?.path as string ?? location?.name ?? 'Unknown',
        }],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ tool: this.name, error: errorMessage }, 'find_item failed');
      return { found: false, error: errorMessage };
    }
  }
}
