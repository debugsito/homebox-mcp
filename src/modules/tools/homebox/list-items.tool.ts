import { HomeBoxService } from '../../homebox/homebox.service.js';
import { logger } from '../../../utils/logger.js';
import { listItemsInputSchema } from '../tool.schemas.js';
import type { Tool } from '../tool.types.js';

export class ListItemsTool implements Tool {
  public name = 'list_items';
  public description = 'List all inventory items with pagination';
  public inputSchema = listItemsInputSchema;

  private service: HomeBoxService;

  constructor() {
    this.service = new HomeBoxService();
  }

  async execute(input: unknown) {
    const parsed = listItemsInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { limit, page } = parsed.data;
    logger.debug({ tool: this.name, limit, page }, 'Executing list_items');

    const result = await this.service.listItems(page, limit);
    logger.info({ tool: this.name, items: result.items }, 'Tool result from HomeBoxService');

    return result.items;
  }
}
