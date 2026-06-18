import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { buildApp } from './app.js';

const start = async () => {
  try {
    const app = await buildApp();

    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info(`Server listening on port ${config.PORT}`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
};

start();
