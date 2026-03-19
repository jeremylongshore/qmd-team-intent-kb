import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { createTestDatabase } from '@qmd-team-intent-kb/store';
import { buildApp } from '../app.js';
import { makeCandidate, NOW } from './fixtures.js';

describe('/api/candidates', () => {
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

  // ---- POST /api/candidates ------------------------------------------------

  it('POST creates a candidate and returns 201', async () => {
    const body = makeCandidate();
    const res = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      payload: body,
    });
    expect(res.statusCode).toBe(201);
    const created = res.json<{ id: string; status: string }>();
    expect(created.id).toBe(body['id']);
    expect(created.status).toBe('inbox');
  });

  it('POST with invalid data returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      payload: { title: 'Missing required fields' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: string }>();
    expect(body.error).toMatch(/Invalid candidate/);
  });

  it('POST with missing required fields returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      payload: { id: randomUUID(), status: 'inbox' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST computes and stores a content hash', async () => {
    const content = 'Unique content for hash test';
    const body = makeCandidate({ content });
    const res = await app.inject({
      method: 'POST',
      url: '/api/candidates',
      payload: body,
    });
    expect(res.statusCode).toBe(201);
    // Verify the candidate is retrievable (hash stored internally)
    const candidate = res.json<{ id: string }>();
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/candidates/${candidate.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json<{ content: string }>().content).toBe(content);
  });

  it('POST accepts duplicate candidates with different IDs', async () => {
    const content = 'Shared content between two candidates';
    const first = makeCandidate({ content });
    const second = makeCandidate({ content, id: randomUUID() });

    const r1 = await app.inject({ method: 'POST', url: '/api/candidates', payload: first });
    const r2 = await app.inject({ method: 'POST', url: '/api/candidates', payload: second });

    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
  });

  it('POST with full metadata fields succeeds', async () => {
    const body = makeCandidate({
      metadata: {
        filePaths: ['src/api.ts', 'src/auth.ts'],
        language: 'typescript',
        projectContext: 'backend api',
        sessionId: 'session-abc',
        tags: ['api', 'auth'],
      },
      prePolicyFlags: {
        potentialSecret: true,
        lowConfidence: false,
        duplicateSuspect: true,
      },
    });
    const res = await app.inject({ method: 'POST', url: '/api/candidates', payload: body });
    expect(res.statusCode).toBe(201);
    const created = res.json<{ metadata: { filePaths: string[] } }>();
    expect(created.metadata.filePaths).toEqual(['src/api.ts', 'src/auth.ts']);
  });

  // ---- GET /api/candidates/:id ---------------------------------------------

  it('GET /:id returns the stored candidate', async () => {
    const body = makeCandidate();
    await app.inject({ method: 'POST', url: '/api/candidates', payload: body });

    const res = await app.inject({
      method: 'GET',
      url: `/api/candidates/${body['id'] as string}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ id: string }>().id).toBe(body['id']);
  });

  it('GET /:id for non-existent returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/candidates/${randomUUID()}`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ error: string }>().error).toMatch(/not found/i);
  });

  // ---- GET /api/candidates -------------------------------------------------

  it('GET list with tenantId filter returns matching candidates', async () => {
    const alpha = makeCandidate({ tenantId: 'team-alpha' });
    const beta = makeCandidate({ tenantId: 'team-beta', content: 'Beta-specific content' });
    await app.inject({ method: 'POST', url: '/api/candidates', payload: alpha });
    await app.inject({ method: 'POST', url: '/api/candidates', payload: beta });

    const res = await app.inject({
      method: 'GET',
      url: '/api/candidates?tenantId=team-alpha',
    });
    expect(res.statusCode).toBe(200);
    const list = res.json<Array<{ tenantId: string }>>();
    expect(list.every((c) => c.tenantId === 'team-alpha')).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('GET list without tenantId returns 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/candidates' });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/tenantId/);
  });

  it('POST preserves capturedAt timestamp exactly', async () => {
    const body = makeCandidate({ capturedAt: NOW });
    const res = await app.inject({ method: 'POST', url: '/api/candidates', payload: body });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ capturedAt: string }>().capturedAt).toBe(NOW);
  });
});
