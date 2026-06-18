import { toolRegistry } from './tool.registry.js';
import { SearchItemTool } from './homebox/search-item.tool.js';
import { GetItemTool } from './homebox/get-item.tool.js';
import { ListLocationsTool } from './homebox/list-locations.tool.js';
import { ListItemsTool } from './homebox/list-items.tool.js';
import { CreateItemTool } from './homebox/create-item.tool.js';
import { UpdateItemTool } from './homebox/update-item.tool.js';
import { MoveItemTool } from './homebox/move-item.tool.js';
import { ResolveLocationTool } from './homebox/resolve-location.tool.js';
import { ResolveItemTool } from './homebox/resolve-item.tool.js';

// Register all tools
toolRegistry.register(new SearchItemTool());
toolRegistry.register(new GetItemTool());
toolRegistry.register(new ListLocationsTool());
toolRegistry.register(new ListItemsTool());
toolRegistry.register(new CreateItemTool());
toolRegistry.register(new UpdateItemTool());
toolRegistry.register(new MoveItemTool());
toolRegistry.register(new ResolveLocationTool());
toolRegistry.register(new ResolveItemTool());

export { toolRegistry } from './tool.registry.js';
export type { Tool, ToolExecutionContext, ToolRunRequest, ToolRunResponse } from './tool.types.js';
export * from './tool.schemas.js';
