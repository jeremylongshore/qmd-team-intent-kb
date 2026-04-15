import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

/**
 * Register the OpenAPI 3.1 spec generator and Swagger UI.
 *
 * MUST be registered BEFORE routes so that Fastify route registrations
 * emit their `schema` metadata into the generated document.
 *
 * Registration is deferred (Fastify's `register` is promise-based but the
 * plugins are loaded by `app.ready()`). We do not await here so `buildApp`
 * can remain synchronous; callers that need the spec to be served must
 * call `await app.ready()` before `inject()` or `listen()` — which the
 * existing test suite and `index.ts` already do.
 *
 * Exposes:
 * - GET /openapi.json — the generated spec
 * - GET /docs         — Swagger UI
 */
export function registerOpenApi(app: FastifyInstance): void {
  void app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'qmd Team Intent KB API',
        description:
          'Control plane REST API for the governed team memory platform. Exposes candidate intake, curated memory lifecycle, governance policies, audit trail, and search.',
        version: '0.4.0',
      },
      tags: [
        { name: 'health', description: 'Liveness and readiness probes' },
        { name: 'candidates', description: 'Memory candidate intake and retrieval' },
        { name: 'memories', description: 'Curated memory retrieval and lifecycle' },
        { name: 'policies', description: 'Governance policy CRUD' },
        { name: 'audit', description: 'Immutable audit event queries' },
        { name: 'search', description: 'Full-text search over curated memories' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            description:
              'Bearer token authentication. In production TEAMKB_API_KEY is required; in development auth is skipped when unset.',
          },
        },
      },
    },
  });

  void app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });

  // Expose the generated spec at a stable well-known path. @fastify/swagger
  // itself does not register a route; only @fastify/swagger-ui does (under
  // its own prefix). We publish /openapi.json so SDK generators and tooling
  // can fetch the document without depending on the UI route prefix.
  app.get(
    '/openapi.json',
    {
      schema: {
        hide: true,
      },
    },
    async () => app.swagger(),
  );
}
