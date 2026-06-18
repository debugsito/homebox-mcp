import type { FastifyPluginAsync } from 'fastify';
import { HomeBoxService } from './homebox.service.js';
import type {
  HomeBoxEntitiesResponse,
  HomeBoxLocationsResponse,
  HomeBoxEntity,
} from './homebox.types.js';

interface IdParams {
  id: string;
}

interface SearchQuery {
  q?: string;
  page?: string;
  pageSize?: string;
}

interface ListQuery {
  page?: string;
  pageSize?: string;
}

interface LocationsQuery {
  withItems?: string;
}

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

const routes: FastifyPluginAsync = async (fastify) => {
  const service = new HomeBoxService();

  // GET /homebox/items
  fastify.get<{ Querystring: ListQuery; Reply: HomeBoxEntitiesResponse | ErrorResponse }>(
    '/items',
    async (request, reply) => {
      try {
        const page = parseInt(request.query.page ?? '1', 10);
        const pageSize = parseInt(request.query.pageSize ?? '50', 10);
        const result = await service.listItems(page, pageSize);
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return reply.status(502).send({ error: 'HomeBox Error', message, statusCode: 502 });
      }
    }
  );

  // GET /homebox/items/search?q=texto
  fastify.get<{ Querystring: SearchQuery; Reply: HomeBoxEntitiesResponse | ErrorResponse }>(
    '/items/search',
    async (request, reply) => {
      try {
        const { q = '', page = '1', pageSize = '50' } = request.query;
        const result = await service.searchItems(q, parseInt(page, 10), parseInt(pageSize, 10));
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return reply.status(502).send({ error: 'HomeBox Error', message, statusCode: 502 });
      }
    }
  );

  // GET /homebox/items/:id
  fastify.get<{ Params: IdParams; Reply: HomeBoxEntity | ErrorResponse }>(
    '/items/:id',
    async (request, reply) => {
      try {
        const item = await service.getItemById(request.params.id);
        return reply.send(item);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return reply.status(502).send({ error: 'HomeBox Error', message, statusCode: 502 });
      }
    }
  );

  // GET /homebox/locations
  fastify.get<{ Querystring: LocationsQuery; Reply: HomeBoxLocationsResponse | ErrorResponse }>(
    '/locations',
    async (request, reply) => {
      try {
        const withItems = request.query.withItems === 'true';
        const locations = await service.listLocations(withItems);
        return reply.send(locations);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return reply.status(502).send({ error: 'HomeBox Error', message, statusCode: 502 });
      }
    }
  );

  // GET /homebox/locations/:id
  fastify.get<{ Params: IdParams; Reply: HomeBoxEntity | ErrorResponse }>(
    '/locations/:id',
    async (request, reply) => {
      try {
        const location = await service.getLocationById(request.params.id);
        return reply.send(location);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return reply.status(502).send({ error: 'HomeBox Error', message, statusCode: 502 });
      }
    }
  );
};

export default routes;
