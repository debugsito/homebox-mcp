import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildMcpServer } from './build-server.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { timingSafeEqual } from 'node:crypto';

/** Comparacion en tiempo constante, para no filtrar el token por latencia. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isAuthorized(request: FastifyRequest): boolean {
  const expected = config.MCP_AUTH_TOKEN;
  if (!expected) {
    return false;
  }

  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return false;
  }

  return tokenMatches(header.slice('Bearer '.length).trim(), expected);
}

/**
 * Streamable HTTP sin sesion: cada peticion crea su propio servidor y
 * transporte, y los cierra al terminar. Evita fugas entre clientes y es
 * suficiente para un inventario de una sola persona.
 */
const routes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isAuthorized(request)) {
      logger.warn({ ip: request.ip }, 'MCP request rejected');
      return reply.status(401).send({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized' },
        id: null,
      });
    }

    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    reply.raw.on('close', () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);

    return reply;
  });

  // El modo sin sesion no soporta el canal SSE ni la terminacion de sesion.
  for (const method of ['get', 'delete'] as const) {
    fastify[method]('/', async (_request, reply) =>
      reply.status(405).send({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed' },
        id: null,
      })
    );
  }
};

export default routes;
