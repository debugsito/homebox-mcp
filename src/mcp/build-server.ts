import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolRegistry } from '../modules/tools/index.js';
import { homeBoxService } from '../modules/homebox/homebox.service.js';
import { buildLocationPaths } from '../modules/resolvers/location-path.builder.js';
import type { LocationTreeNode } from '../modules/resolvers/resolver.types.js';
import { logger } from '../utils/logger.js';

const NAME = 'homebox-inventory';
const VERSION = '0.1.0';

/**
 * Expone el registry de tools por MCP. Las anotaciones viajan al cliente para
 * que sepa cuales solo leen y cuales modifican el inventario.
 */
export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: NAME, version: VERSION });

  for (const tool of toolRegistry.getAll()) {
    const shape = (tool.inputSchema as unknown as z.ZodObject<z.ZodRawShape>).shape;

    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: shape,
        annotations: {
          readOnlyHint: tool.readOnly,
          destructiveHint: tool.destructive,
          idempotentHint: tool.readOnly,
          openWorldHint: false,
        },
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.execute(args);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          logger.error({ tool: tool.name, error: message }, 'MCP tool failed');
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error en ${tool.name}: ${message}` }],
          };
        }
      }
    );
  }

  // El arbol completo como recurso: evita que el cliente gaste una tool call
  // solo para saber que ubicaciones existen.
  server.registerResource(
    'locations',
    'homebox://locations',
    {
      title: 'Árbol de ubicaciones',
      description: 'Todas las ubicaciones del inventario con su ruta completa',
      mimeType: 'text/plain',
    },
    async () => {
      const tree = await homeBoxService.listLocations(false);
      const paths = buildLocationPaths(tree as LocationTreeNode[]);
      return {
        contents: [
          {
            uri: 'homebox://locations',
            mimeType: 'text/plain',
            text: paths.map((p) => p.path).join('\n'),
          },
        ],
      };
    }
  );

  logger.debug({ tools: toolRegistry.listNames().length }, 'MCP server built');
  return server;
}
