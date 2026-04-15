import type { FastifyInstance } from 'fastify';

/** HTTP methods accepted by Fastify's inject helper */
type InjectMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** Parsed result of a test HTTP request */
export interface InjectResult {
  /** HTTP status code returned by the handler */
  status: number;
  /** Response body parsed as JSON (`unknown` — narrow with `as T` or structural matchers) */
  body: unknown;
}

/**
 * Fire a single Fastify inject request and return the status code plus the
 * parsed JSON body in one step.  This removes the repetitive three-line
 * pattern of `app.inject → statusCode → json()` from every test case.
 *
 * @example
 * const res = await injectJson(app, 'POST', '/api/candidates', makeCandidate());
 * expect(res.status).toBe(201);
 * expect((res.body as { id: string }).id).toBe(expected);
 */
export async function injectJson(
  app: FastifyInstance,
  method: InjectMethod,
  url: string,
  payload?: Record<string, unknown>,
): Promise<InjectResult> {
  const res = await app.inject({ method, url, payload });
  return { status: res.statusCode, body: res.json() };
}
