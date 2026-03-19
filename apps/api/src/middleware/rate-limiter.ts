import type { FastifyInstance } from 'fastify';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * In-memory sliding window rate limiter per IP.
 * Returns 429 when the limit is exceeded.
 */
export function registerRateLimiter(
  app: FastifyInstance,
  maxRequests: number,
  windowMs: number,
): void {
  const clients = new Map<string, RateLimitEntry>();

  // Periodic cleanup to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of clients) {
      if (now - entry.windowStart > windowMs * 2) {
        clients.delete(ip);
      }
    }
  }, windowMs);

  // Don't keep the process alive just for cleanup
  cleanupInterval.unref();

  app.addHook('onRequest', async (request, reply) => {
    const ip = request.ip;
    const now = Date.now();
    const entry = clients.get(ip);

    if (entry === undefined || now - entry.windowStart > windowMs) {
      clients.set(ip, { count: 1, windowStart: now });
      return;
    }

    entry.count++;

    if (entry.count > maxRequests) {
      reply.status(429);
      throw new Error('Too many requests');
    }
  });
}
