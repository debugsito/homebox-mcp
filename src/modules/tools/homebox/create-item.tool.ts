import { HomeBoxService } from '../../homebox/homebox.service.js';
import { logger } from '../../../utils/logger.js';
import { createItemInputSchema } from '../tool.schemas.js';
import type { Tool } from '../tool.types.js';

export class CreateItemTool implements Tool {
  public name = 'create_item';
  public description = 'Create a new inventory item';
  public inputSchema = createItemInputSchema;

  private service: HomeBoxService;

  constructor() {
    this.service = new HomeBoxService();
  }

  async execute(input: unknown) {
    const parsed = createItemInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { name, description, parentId, quantity } = parsed.data;
    logger.info({ tool: this.name, name, parentId }, 'Executing create_item');

    return this.service.createItem({ name, description, parentId, quantity });
  }
}
