import type { FastifyInstance } from 'fastify';

/**
 * Optional bearer token authentication middleware.
 * If TEAMKB_API_KEY is not set, authentication is skipped (dev mode).
 * The health endpoint is always exempt.
 */
export function registerApiKeyAuth(app: FastifyInstance, apiKey: string | undefined): void {
  if (apiKey === undefined || apiKey === '') {
    return; // Dev mode — no auth required
  }

  app.addHook('onRequest', async (request, reply) => {
    // Health endpoint is always exempt
    if (request.url === '/health' || request.url === '/health/') {
      return;
    }

    const authHeader = request.headers['authorization'];

    if (authHeader === undefined) {
      reply.status(401);
      throw new Error('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || token !== apiKey) {
      reply.status(401);
      throw new Error('Invalid API key');
    }
  });
}
