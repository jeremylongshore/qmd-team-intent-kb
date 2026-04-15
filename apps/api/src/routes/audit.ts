import type { FastifyInstance } from 'fastify';
import type { AuditRepository } from '@qmd-team-intent-kb/store';

/**
 * Register audit event query routes.
 * The audit log is append-only; this endpoint only supports reads.
 *
 * GET /api/audit — query by tenantId, memoryId, or action (query params)
 *
 * When multiple filters are supplied the most specific wins:
 * memoryId > action > tenantId. If none are supplied an empty array
 * is returned — a tenant scope is recommended for production use.
 */
export function registerAuditRoutes(app: FastifyInstance, repo: AuditRepository): void {
  app.get(
    '/api/audit',
    {
      schema: {
        tags: ['audit'],
        summary: 'Query the immutable audit event log',
        description:
          'Filter precedence: `memoryId` > `action` > `tenantId`. Returns `[]` if no filter is provided.',
      },
    },
    async (request, reply) => {
      const { tenantId, memoryId, action } = request.query as {
        tenantId?: string;
        memoryId?: string;
        action?: string;
      };

      if (memoryId !== undefined && memoryId.length > 0) {
        return reply.send(repo.findByMemory(memoryId));
      }

      if (action !== undefined && action.length > 0) {
        return reply.send(repo.findByAction(action));
      }

      if (tenantId !== undefined && tenantId.length > 0) {
        return reply.send(repo.findByTenant(tenantId));
      }

      return reply.send([]);
    },
  );
}
