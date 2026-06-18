import healthRoutes from './health.routes.js';
import homeboxRoutes from '../modules/homebox/homebox.routes.js';
import toolsRoutes from '../modules/tools/tools.routes.js';
const routes = async (fastify) => {
    await fastify.register(healthRoutes);
    await fastify.register(homeboxRoutes, { prefix: '/homebox' });
    await fastify.register(toolsRoutes, { prefix: '/tools' });
};
export default routes;
//# sourceMappingURL=index.js.map