import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export type AppInstance = FastifyInstance;
export type AppRequest = FastifyRequest;
export type AppReply = FastifyReply;

export interface HealthResponse {
  status: 'ok';
}
