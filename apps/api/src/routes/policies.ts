import type { FastifyInstance } from 'fastify';
import { ApiError } from '../errors.js';
import type { PolicyService } from '../services/policy-service.js';

/**
 * Register governance policy CRUD routes.
 *
 * POST   /api/policies            — create policy (201)
 * GET    /api/policies            — list by tenantId (200 | 400)
 * GET    /api/policies/:id        — get by UUID (200 | 404)
 * PUT    /api/policies/:id        — full replace update (200 | 400 | 404)
 * DELETE /api/policies/:id        — delete (204 | 404)
 */
export function registerPolicyRoutes(app: FastifyInstance, service: PolicyService): void {
  app.post(
    '/api/policies',
    {
      schema: {
        tags: ['policies'],
        summary: 'Create a governance policy',
      },
    },
    async (request, reply) => {
      try {
        const policy = service.create(request.body);
        return reply.status(201).send(policy);
      } catch (err) {
        if (err instanceof ApiError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.get(
    '/api/policies',
    {
      schema: {
        tags: ['policies'],
        summary: 'List policies for a tenant',
        description: 'Requires `tenantId` query param.',
      },
    },
    async (request, reply) => {
      try {
        const { tenantId } = request.query as { tenantId?: string };
        const policies = service.list(tenantId);
        return reply.send(policies);
      } catch (err) {
        if (err instanceof ApiError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.get(
    '/api/policies/:id',
    {
      schema: {
        tags: ['policies'],
        summary: 'Retrieve a policy by UUID',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const policy = service.getById(id);
        return reply.send(policy);
      } catch (err) {
        if (err instanceof ApiError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.put(
    '/api/policies/:id',
    {
      schema: {
        tags: ['policies'],
        summary: 'Replace an existing policy',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const policy = service.update(id, request.body);
        return reply.send(policy);
      } catch (err) {
        if (err instanceof ApiError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.delete(
    '/api/policies/:id',
    {
      schema: {
        tags: ['policies'],
        summary: 'Delete a policy',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        service.delete(id);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof ApiError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
