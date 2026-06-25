import type { FastifyPluginAsync } from 'fastify';
import healthRoutes from './health.routes.js';
import homeboxRoutes from '../modules/homebox/homebox.routes.js';
import toolsRoutes from '../modules/tools/tools.routes.js';
import aiRoutes from '../modules/ai/ai.routes.js';

const routes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
  await fastify.register(homeboxRoutes, { prefix: '/homebox' });
  await fastify.register(toolsRoutes, { prefix: '/tools' });
  await fastify.register(aiRoutes, { prefix: '/ai' });
};

export default routes;
