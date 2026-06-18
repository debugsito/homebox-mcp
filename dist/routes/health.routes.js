const routes = async (fastify) => {
    fastify.get('/health', async (_request, reply) => {
        return reply.send({ status: 'ok' });
    });
};
export default routes;
//# sourceMappingURL=health.routes.js.map