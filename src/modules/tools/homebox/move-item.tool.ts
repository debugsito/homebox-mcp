import { HomeBoxService } from '../../homebox/homebox.service.js';
import { logger } from '../../../utils/logger.js';
import { moveItemInputSchema } from '../tool.schemas.js';
import type { Tool } from '../tool.types.js';

export class MoveItemTool implements Tool {
  public name = 'move_item';
  public description = 'Move an inventory item to a different location';
  public inputSchema = moveItemInputSchema;

  private service: HomeBoxService;

  constructor() {
    this.service = new HomeBoxService();
  }

  async execute(input: unknown) {
    const parsed = moveItemInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { itemId, parentId } = parsed.data;
    logger.info({ tool: this.name, itemId, parentId }, 'Executing move_item');

    return this.service.moveItem(itemId, parentId);
  }
}
