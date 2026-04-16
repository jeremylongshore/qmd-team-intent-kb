import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError, badRequest } from '../errors.js';
import type { ImportService } from '../services/import-service.js';

const ImportBodySchema = z.object({
  sourcePath: z.string().min(1),
  tenantId: z.string().min(1),
  excludeDirs: z.array(z.string()).optional(),
});

/**
 * Register import routes for vault import operations.
 *
 * POST   /api/import/preview      — dry-run analysis (200)
 * POST   /api/import              — execute import (201)
 * GET    /api/import/batches      — list batches (200)
 * GET    /api/import/batches/:id  — get batch details (200 | 404)
 * DELETE /api/import/batches/:id  — rollback a batch (200 | 400 | 404)
 */
export function registerImportRoutes(app: FastifyInstance, service: ImportService): void {
  app.post(
    '/api/import/preview',
    {
      schema: {
        tags: ['import'],
        summary: 'Preview an import without persisting',
        description: 'Walks the vault directory, checks collisions, and reports what would happen.',
      },
    },
    async (request, reply) => {
      try {
        const parsed = ImportBodySchema.safeParse(request.body);
        if (!parsed.success) {
          throw badRequest(
            parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          );
        }
        const result = await service.preview(
          parsed.data.sourcePath,
          parsed.data.tenantId,
          parsed.data.excludeDirs,
        );
        return reply.status(200).send(result);
      } catch (err) {
        if (err instanceof ApiError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    '/api/import',
    {
      schema: {
        tags: ['import'],
        summary: 'Execute a vault import',
        description:
          'Walks the vault directory, creates candidates with batch tracking, and returns results.',
      },
    },
    async (request, reply) => {
      try {
        const parsed = ImportBodySchema.safeParse(request.body);
        if (!parsed.success) {
          throw badRequest(
            parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          );
        }
        const result = await service.execute(
          parsed.data.sourcePath,
          parsed.data.tenantId,
          parsed.data.excludeDirs,
        );
        return reply.status(201).send(result);
      } catch (err) {
        if (err instanceof ApiError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.get(
    '/api/import/batches',
    {
      schema: {
        tags: ['import'],
        summary: 'List import batches',
        description: 'Returns all import batches, optionally filtered by tenantId.',
      },
    },
    async (request, reply) => {
      const query = request.query as { tenantId?: string };
      const batches = service.listBatches(query.tenantId);
      return reply.status(200).send(batches);
    },
  );

  app.get(
    '/api/import/batches/:id',
    {
      schema: {
        tags: ['import'],
        summary: 'Get import batch details',
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { id: string };
        const batch = service.getBatch(params.id);
        return reply.status(200).send(batch);
      } catch (err) {
        if (err instanceof ApiError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.delete(
    '/api/import/batches/:id',
    {
      schema: {
        tags: ['import'],
        summary: 'Roll back an import batch',
        description: 'Deletes all candidates created by the batch and marks it as rolled_back.',
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { id: string };
        const result = service.rollback(params.id);
        return reply.status(200).send(result);
      } catch (err) {
        if (err instanceof ApiError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
