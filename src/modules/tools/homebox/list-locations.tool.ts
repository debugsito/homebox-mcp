import { HomeBoxService } from '../../homebox/homebox.service.js';
import { logger } from '../../../utils/logger.js';
import { listLocationsInputSchema } from '../tool.schemas.js';
import { buildLocationPaths } from '../../resolvers/location-path.builder.js';
import type { Tool } from '../tool.types.js';
import type { LocationTreeNode } from '../../resolvers/resolver.types.js';

export class ListLocationsTool implements Tool {
  public name = 'list_locations';
  public description = 'List all inventory locations with full paths';
  public inputSchema = listLocationsInputSchema;

  private service: HomeBoxService;

  constructor() {
    this.service = new HomeBoxService();
  }

  async execute(input: unknown) {
    const parsed = listLocationsInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { withItems } = parsed.data;
    logger.debug({ tool: this.name, withItems }, 'Executing list_locations');

    const tree = await this.service.listLocations(withItems);
    const locationsWithPaths = buildLocationPaths(tree as LocationTreeNode[]);

    return locationsWithPaths;
  }
}
