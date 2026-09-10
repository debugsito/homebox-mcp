import pino from 'pino';
import { config } from '../config/index.js';

const isDev = config.NODE_ENV === 'development';

/**
 * Todo el log va a stderr (fd 2). En el transporte stdio del MCP, stdout es el
 * canal JSON-RPC: una sola linea de log ahi rompe la sesion con el cliente.
 */
export const logger = pino(
  {
    level: isDev ? 'debug' : 'info',
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            destination: 2,
          },
        }
      : undefined,
  },
  isDev ? undefined : pino.destination(2)
);
