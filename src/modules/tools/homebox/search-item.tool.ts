import { HomeBoxService } from '../../homebox/homebox.service.js';
import { logger } from '../../../utils/logger.js';
import { searchItemInputSchema } from '../tool.schemas.js';
import type { Tool } from '../tool.types.js';

export class SearchItemTool implements Tool {
  public name = 'search_item';
  public description = 'Search inventory items by text query';
  public inputSchema = searchItemInputSchema;

  private service: HomeBoxService;

  constructor() {
    this.service = new HomeBoxService();
  }

  async execute(input: unknown) {
    const parsed = searchItemInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { query, limit } = parsed.data;
    logger.debug({ tool: this.name, query, limit }, 'Executing search_item');

    const result = await this.service.searchItems(query, 1, limit);
    logger.info({ tool: this.name, items: result.items }, 'Tool result from HomeBoxService');

    return result.items;
  }
}
