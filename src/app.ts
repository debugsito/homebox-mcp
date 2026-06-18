import Fastify from 'fastify';
import loggerPlugin from './plugins/logger.plugin.js';
import routes from './routes/index.js';

export const buildApp = async () => {
  const app = Fastify({
    logger: false,
  });

  await app.register(loggerPlugin);
  await app.register(routes);

  return app;
};
