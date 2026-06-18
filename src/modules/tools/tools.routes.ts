import type { FastifyPluginAsync } from 'fastify';
import { toolRegistry } from './index.js';
import { toolRunRequestSchema } from './tool.schemas.js';
import type { ToolRunResponse } from './tool.types.js';
import { logger } from '../../utils/logger.js';

const routes: FastifyPluginAsync = async (fastify) => {
  // POST /tools/run
  fastify.post<{ Body: { tool?: string; input?: Record<string, unknown> }; Reply: ToolRunResponse }>(
    '/run',
    async (request, reply) => {
      const parsed = toolRunRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          tool: 'unknown',
          error: `Invalid request: ${parsed.error.message}`,
          executionMs: 0,
        });
      }

      const { tool: toolName, input = {} } = parsed.data;
      const start = Date.now();

      const tool = toolRegistry.get(toolName);

      if (!tool) {
        const duration = Date.now() - start;
        logger.warn({ tool: toolName, duration }, 'Tool not found');
        return reply.status(404).send({
          success: false,
          tool: toolName,
          error: `Tool '${toolName}' not found`,
          executionMs: duration,
        });
      }

      try {
        const result = await tool.execute(input);
        const duration = Date.now() - start;

        logger.info({ tool: toolName, result, resultType: typeof result, isArray: Array.isArray(result) }, 'Tool result received by runner');

        let response: ToolRunResponse;
        if (Array.isArray(result)) {
          response = {
            success: true,
            tool: toolName,
            executionMs: duration,
            count: result.length,
            result,
          };
        } else {
          response = {
            success: true,
            tool: toolName,
            executionMs: duration,
            result,
          };
        }

        logger.info({ tool: toolName, response }, 'Sending response');
        return reply.send(response);
      } catch (err) {
        const duration = Date.now() - start;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ tool: toolName, input, duration, error: errorMessage }, 'Tool execution failed');
        return reply.status(500).send({
          success: false,
          tool: toolName,
          error: errorMessage,
          executionMs: duration,
        });
      }
    }
  );

  // GET /tools - list available tools
  fastify.get('/', async () => {
    const tools = toolRegistry.getAll().map((t) => ({
      name: t.name,
      description: t.description,
    }));
    return { tools };
  });
};

export default routes;
