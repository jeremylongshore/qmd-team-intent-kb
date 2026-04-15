import type { FastifyInstance } from 'fastify';
import type { HealthService } from '../services/health-service.js';

/**
 * Register the health check route.
 * GET /api/health — returns liveness and database connectivity.
 */
export function registerHealthRoutes(app: FastifyInstance, service: HealthService): void {
  app.get(
    '/api/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness and database reachability probe',
        description:
          'Returns `healthy` with uptime and version when the database is reachable, `unhealthy` (503) otherwise.',
      },
    },
    async (_request, reply) => {
      const status = service.check();
      const httpStatus = status.status === 'healthy' ? 200 : 503;
      return reply.status(httpStatus).send(status);
    },
  );
}
