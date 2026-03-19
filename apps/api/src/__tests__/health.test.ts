import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { createTestDatabase } from '@qmd-team-intent-kb/store';
import { buildApp } from '../app.js';

describe('GET /api/health', () => {
  let db: Database.Database;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = createTestDatabase();
    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('returns status healthy when the database is reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string }>();
    expect(body.status).toBe('healthy');
  });

  it('returns a non-negative uptime in seconds', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const body = res.json<{ uptime: number }>();
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('returns the current API version', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const body = res.json<{ version: string }>();
    expect(body.version).toBe('0.4.0');
  });
});
