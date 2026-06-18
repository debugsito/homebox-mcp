import healthRoutes from './health.routes.js';
import homeboxRoutes from '../modules/homebox/homebox.routes.js';
const routes = async (fastify) => {
    await fastify.register(healthRoutes);
    await fastify.register(homeboxRoutes, { prefix: '/homebox' });
};
export default routes;
//# sourceMappingURL=index.js.map