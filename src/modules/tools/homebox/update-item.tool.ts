import { HomeBoxService } from '../../homebox/homebox.service.js';
import { logger } from '../../../utils/logger.js';
import { updateItemInputSchema } from '../tool.schemas.js';
import type { Tool } from '../tool.types.js';

export class UpdateItemTool implements Tool {
  public name = 'update_item';
  public description = 'Update an existing inventory item';
  public inputSchema = updateItemInputSchema;

  private service: HomeBoxService;

  constructor() {
    this.service = new HomeBoxService();
  }

  async execute(input: unknown) {
    const parsed = updateItemInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { itemId, name, description, parentId, quantity } = parsed.data;
    logger.info({ tool: this.name, itemId, name, description, parentId }, 'Executing update_item');

    const payload: { name?: string; description?: string; parentId?: string; quantity?: number } = {};
    if (name !== undefined) payload.name = name;
    if (description !== undefined) payload.description = description;
    if (parentId !== undefined) payload.parentId = parentId;
    if (quantity !== undefined) payload.quantity = quantity;

    return this.service.updateItem(itemId, payload);
  }
}
