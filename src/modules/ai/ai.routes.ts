import type { FastifyPluginAsync } from 'fastify';
import { AIService } from './ai.service.js';
import { chatRequestSchema } from './chat.schemas.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { getToolsForLLM } from './tool-converter.js';

interface ChatResponse {
  response: string;
  provider: string;
  model: string;
  toolCalls: unknown[];
}

interface ErrorResponse {
  error: string;
  message: string;
}

interface TestResponse {
  provider: string;
  response: string;
}

const routes: FastifyPluginAsync = async (fastify) => {
  const aiService = new AIService();

  // GET /ai/test - Test endpoint
  fastify.get<{ Reply: TestResponse | ErrorResponse }>('/test', async (request, reply) => {
    logger.info({ provider: config.AI_PROVIDER }, 'AI test request');

    try {
      const response = await aiService.chat('Responde únicamente OK');
      return reply.send({
        provider: response.provider,
        response: response.response,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'AI test request failed');

      return reply.status(500).send({
        error: 'AI Service Error',
        message: 'Ocurrió un error al probar el servicio de IA.',
      });
    }
  });

  // POST /ai/debug - Debug endpoint to inspect tool calling
  fastify.post<{ Body: { message?: string }; Reply: unknown }>(
    '/debug',
    async (request, reply) => {
      const body = request.body as { message?: string };

      if (!body?.message) {
        return reply.status(400).send({ error: 'message is required' });
      }

      logger.info({ message: body.message }, 'Debug request received');

      try {
        const debugInfo = await aiService.debug(body.message);
        return reply.send(debugInfo);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ error: errorMessage }, 'Debug request failed');

        return reply.status(500).send({
          error: 'Debug Error',
          message: errorMessage,
        });
      }
    }
  );

  // POST /ai/chat - Main chat endpoint
  fastify.post<{ Body: { message?: string; history?: unknown[] }; Reply: ChatResponse | ErrorResponse }>(
    '/chat',
    async (request, reply) => {
      const parsed = chatRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid request: ${parsed.error.message}`,
        });
      }

      const { message, history = [] } = parsed.data;

      logger.info({ message, historyLength: history.length }, 'Chat request received');

      try {
        const response = await aiService.chat(message, history as never[]);
        return reply.send(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ error: errorMessage }, 'Chat request failed');

        return reply.status(500).send({
          error: 'AI Service Error',
          message: 'Ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.',
        });
      }
    }
  );

  // GET /ai/tools - List tools being sent to the AI
  fastify.get('/tools', async (request, reply) => {
    const tools = getToolsForLLM();
    return reply.send({ tools, count: tools.length });
  });
};

export default routes;
