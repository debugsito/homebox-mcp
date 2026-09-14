import { homeBoxService, HomeBoxService } from '../../homebox/homebox.service.js';
import { LocationResolverService } from '../../resolvers/location-resolver.service.js';
import { summarizeItems } from '../../homebox/item.summary.js';
import { logger } from '../../../utils/logger.js';
import { listItemsInputSchema } from '../tool.schemas.js';
import type { Tool } from '../tool.types.js';

export class ListItemsTool implements Tool {
  public name = 'list_items';
  public description =
    'List inventory items. Pass `location` to list only what is inside a given place ' +
    '(name or full path) instead of the whole inventory.';
  public readOnly = true;
  public destructive = false;
  public inputSchema = listItemsInputSchema;

  private service: HomeBoxService;
  private locations: LocationResolverService;

  constructor(service: HomeBoxService = homeBoxService) {
    this.service = service;
    this.locations = new LocationResolverService(service);
  }

  async execute(input: unknown) {
    const parsed = listItemsInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.message}`);
    }

    const { limit, page, location } = parsed.data;
    let parentIds: string[] = [];

    if (location) {
      const resolucion = await this.locations.resolve(location);

      if (resolucion.count === 0) {
        return { error: `No existe la ubicación "${location}"`, items: [] };
      }
      if (resolucion.ambiguous) {
        return {
          error: `"${location}" coincide con varias ubicaciones. Concreta cuál.`,
          candidatos: resolucion.result.map((l) => l.path),
          items: [],
        };
      }

      parentIds = [resolucion.result[0].id];
    }

    logger.debug({ tool: this.name, limit, page, location }, 'Executing list_items');

    const result = await this.service.listItems(page, limit, parentIds);
    return summarizeItems(result.items);
  }
}
