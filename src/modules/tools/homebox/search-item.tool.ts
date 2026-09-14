import { homeBoxService, HomeBoxService } from '../../homebox/homebox.service.js';
import { summarizeItems } from '../../homebox/item.summary.js';
import { logger } from '../../../utils/logger.js';
import { searchItemInputSchema } from '../tool.schemas.js';
import type { Tool } from '../tool.types.js';

export class SearchItemTool implements Tool {
  public name = 'search_item';
  public description = 'Search inventory items by text query';
  public readOnly = true;
  public destructive = false;
  public inputSchema = searchItemInputSchema;

  private service: HomeBoxService;

  constructor(service: HomeBoxService = homeBoxService) {
    this.service = service;
  }

  async execute(input: unknown) {
    const parsed = searchItemInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { query, limit } = parsed.data;
    logger.debug({ tool: this.name, query, limit }, 'Executing search_item');

    const result = await this.service.searchItems(query, 1, limit);
    return summarizeItems(result.items);
  }
}
