import type { Tool } from './tool.types.js';
import { logger } from '../../utils/logger.js';

class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      logger.warn({ tool: tool.name }, 'Tool already registered, overwriting');
    }
    this.tools.set(tool.name, tool);
    logger.debug({ tool: tool.name }, 'Tool registered');
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  listNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

export const toolRegistry = new ToolRegistry();
