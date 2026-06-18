import { HomeBoxService } from '../../homebox/homebox.service.js';
import { logger } from '../../../utils/logger.js';
import { getItemInputSchema } from '../tool.schemas.js';
import type { Tool } from '../tool.types.js';

export class GetItemTool implements Tool {
  public name = 'get_item';
  public description = 'Get a single inventory item by ID';
  public inputSchema = getItemInputSchema;

  private service: HomeBoxService;

  constructor() {
    this.service = new HomeBoxService();
  }

  async execute(input: unknown) {
    const parsed = getItemInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { id } = parsed.data;
    logger.debug({ tool: this.name, id }, 'Executing get_item');

    return this.service.getItemById(id);
  }
}
