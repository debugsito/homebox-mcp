import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { logger } from '../utils/logger.js';

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request) => {
    logger.debug({ reqId: request.id, method: request.method, url: request.url }, 'Incoming request');
  });

  fastify.addHook('onResponse', async (request, reply) => {
    logger.debug({ reqId: request.id, statusCode: reply.statusCode }, 'Request completed');
  });
};

export default plugin;
