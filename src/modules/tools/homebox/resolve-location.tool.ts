import { LocationResolverService } from '../../resolvers/location-resolver.service.js';
import { logger } from '../../../utils/logger.js';
import { z } from 'zod';
import type { Tool } from '../tool.types.js';

const resolveLocationInputSchema = z.object({
  query: z.string().min(1, 'Query is required'),
});

type ResolveLocationInput = z.infer<typeof resolveLocationInputSchema>;

export class ResolveLocationTool implements Tool {
  public name = 'resolve_location';
  public description = 'Resolve a human location name/path into HomeBox location IDs with full paths';
  public inputSchema = resolveLocationInputSchema;

  private resolver: LocationResolverService;

  constructor() {
    this.resolver = new LocationResolverService();
  }

  async execute(input: unknown) {
    const parsed = resolveLocationInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { query } = parsed.data as ResolveLocationInput;
    logger.info({ tool: this.name, query }, 'Executing resolve_location');

    return this.resolver.resolve(query);
  }
}
