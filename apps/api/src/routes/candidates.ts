import type { FastifyInstance } from 'fastify';
import { ApiError } from '../errors.js';
import type { CandidateService } from '../services/candidate-service.js';

/**
 * Register candidate intake and retrieval routes.
 *
 * POST   /api/candidates          — intake a new candidate (201)
 * GET    /api/candidates/:id      — retrieve by UUID (200 | 404)
 * GET    /api/candidates          — list by tenantId query param (200 | 400)
 */
export function registerCandidateRoutes(app: FastifyInstance, service: CandidateService): void {
  app.post('/api/candidates', async (request, reply) => {
    try {
      const candidate = service.intake(request.body);
      return reply.status(201).send(candidate);
    } catch (err) {
      if (err instanceof ApiError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/api/candidates/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const candidate = service.getById(id);
      return reply.send(candidate);
    } catch (err) {
      if (err instanceof ApiError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/api/candidates', async (request, reply) => {
    try {
      const { tenantId } = request.query as { tenantId?: string };
      const candidates = service.list(tenantId);
      return reply.send(candidates);
    } catch (err) {
      if (err instanceof ApiError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });
}
