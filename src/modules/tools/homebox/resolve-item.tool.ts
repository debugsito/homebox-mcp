import { ItemResolverService } from '../../resolvers/item-resolver.service.js';
import { logger } from '../../../utils/logger.js';
import { z } from 'zod';
import type { Tool } from '../tool.types.js';

const resolveItemInputSchema = z.object({
  query: z.string().min(1, 'Query is required'),
});

type ResolveItemInput = z.infer<typeof resolveItemInputSchema>;

export class ResolveItemTool implements Tool {
  public name = 'resolve_item';
  public description = 'Resolve a human item name into HomeBox item IDs';
  public inputSchema = resolveItemInputSchema;

  private resolver: ItemResolverService;

  constructor() {
    this.resolver = new ItemResolverService();
  }

  async execute(input: unknown) {
    const parsed = resolveItemInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { query } = parsed.data as ResolveItemInput;
    logger.info({ tool: this.name, query }, 'Executing resolve_item');

    return this.resolver.resolve(query);
  }
}
