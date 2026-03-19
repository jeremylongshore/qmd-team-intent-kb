import type { FastifyInstance } from 'fastify';
import { MemoryLifecycleState } from '@qmd-team-intent-kb/schema';
import { ApiError } from '../errors.js';
import type { MemoryService } from '../services/memory-service.js';

/**
 * Register curated memory retrieval and lifecycle routes.
 *
 * GET  /api/memories                      — list by tenantId query (200)
 * GET  /api/memories/by-hash/:hash        — find by content hash (200 | 404)
 * GET  /api/memories/:id                  — retrieve by UUID (200 | 404)
 * POST /api/memories/:id/transition       — lifecycle transition (200 | 400 | 404)
 *
 * Note: by-hash must be registered before :id so Fastify does not treat
 * "by-hash" as a UUID parameter value.
 */
export function registerMemoryRoutes(app: FastifyInstance, service: MemoryService): void {
  app.get('/api/memories', async (request, reply) => {
    const { tenantId } = request.query as { tenantId?: string };
    const memories = service.list(tenantId);
    return reply.send(memories);
  });

  // Static segment — must come before the /:id wildcard
  app.get('/api/memories/by-hash/:hash', async (request, reply) => {
    try {
      const { hash } = request.params as { hash: string };
      const memory = service.findByHash(hash);
      if (memory === null) {
        return reply.status(404).send({ error: `No memory found with hash ${hash}` });
      }
      return reply.send(memory);
    } catch (err) {
      if (err instanceof ApiError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/api/memories/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const memory = service.getById(id);
      return reply.send(memory);
    } catch (err) {
      if (err instanceof ApiError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/api/memories/:id/transition', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { to?: unknown } & Record<string, unknown>;
      const toRaw = body['to'];

      const toParsed = MemoryLifecycleState.safeParse(toRaw);
      if (!toParsed.success) {
        return reply
          .status(400)
          .send({ error: `Invalid lifecycle state: ${String(toRaw ?? 'undefined')}` });
      }

      // Forward the rest of the body as the TransitionRequest
      const { to: _to, ...transitionBody } = body;
      const memory = service.transition(id, toParsed.data, transitionBody);
      return reply.send(memory);
    } catch (err) {
      if (err instanceof ApiError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });
}
