import type { FastifyInstance } from 'fastify';

/** HTTP methods accepted by Fastify's inject helper */
type InjectMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** Parsed result of a test HTTP request */
export interface InjectResult<T = unknown> {
  /** HTTP status code returned by the handler */
  status: number;
  /** Response body parsed as JSON, typed as T (default `unknown` — narrow at the call site) */
  body: T;
}

/**
 * Fire a single Fastify inject request and return the status code plus the
 * parsed JSON body in one step.  Removes the repetitive three-line pattern
 * of `app.inject → statusCode → json()` from every test case.
 *
 * The body type defaults to `unknown`; callers pass a type argument when
 * they want structural typing without a later cast.
 *
 * @example
 * const res = await injectJson<{ id: string }>(app, 'POST', '/api/candidates', body);
 * expect(res.status).toBe(201);
 * expect(res.body.id).toBe(expected);
 *
 * @example
 * // Empty-body responses (e.g. 204 DELETE) return body as null
 * const res = await injectJson(app, 'DELETE', '/api/policies/abc');
 * expect(res.status).toBe(204);
 * expect(res.body).toBeNull();
 */
export async function injectJson<T = unknown>(
  app: FastifyInstance,
  method: InjectMethod,
  url: string,
  payload?: Record<string, unknown>,
): Promise<InjectResult<T>> {
  const res = await app.inject({ method, url, payload });
  const body = (res.body.length > 0 ? res.json() : null) as T;
  return { status: res.statusCode, body };
}
