import pino from 'pino';
import { config } from '../config/index.js';
const isDev = config.NODE_ENV === 'development';
export const logger = pino({
    level: isDev ? 'debug' : 'info',
    transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
            },
        }
        : undefined,
});
//# sourceMappingURL=logger.js.map