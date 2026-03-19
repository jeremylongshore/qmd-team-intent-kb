import type { FastifyInstance } from 'fastify';

/** Default maximum body size: 1MB */
const DEFAULT_MAX_BODY_SIZE = 1_048_576;

/**
 * Input sanitizer middleware that rejects oversized payloads.
 * Returns 413 Payload Too Large when content-length exceeds the limit.
 */
export function registerInputSanitizer(
  app: FastifyInstance,
  maxBodySize: number = DEFAULT_MAX_BODY_SIZE,
): void {
  app.addHook('onRequest', async (request, reply) => {
    const contentLength = request.headers['content-length'];

    if (contentLength !== undefined) {
      const size = parseInt(contentLength, 10);

      if (!isNaN(size) && size > maxBodySize) {
        reply.status(413);
        throw new Error('Payload too large');
      }
    }
  });
}
