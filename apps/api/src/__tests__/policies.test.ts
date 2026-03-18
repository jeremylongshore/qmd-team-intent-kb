import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { createTestDatabase } from '@qmd-team-intent-kb/store';
import { buildApp } from '../app.js';
import { makePolicy, NOW } from './fixtures.js';

describe('/api/policies', () => {
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

  async function createPolicy(overrides?: Record<string, unknown>) {
    const body = makePolicy(overrides);
    const res = await app.inject({
      method: 'POST',
      url: '/api/policies',
      payload: body,
    });
    return { res, body };
  }

  // ---- POST /api/policies --------------------------------------------------

  it('POST creates a policy and returns 201', async () => {
    const { res, body } = await createPolicy();
    expect(res.statusCode).toBe(201);
    expect(res.json<{ id: string }>().id).toBe(body['id']);
  });

  it('POST with invalid data returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/policies',
      payload: { name: 'Missing required fields' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/Invalid policy/);
  });

  it('POST with missing rules returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/policies',
      payload: makePolicy({ rules: [] }), // min(1) — empty rules invalid
    });
    expect(res.statusCode).toBe(400);
  });

  // ---- GET /api/policies/:id -----------------------------------------------

  it('GET /:id returns the stored policy', async () => {
    const { body } = await createPolicy();
    const res = await app.inject({
      method: 'GET',
      url: `/api/policies/${body['id'] as string}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ id: string }>().id).toBe(body['id']);
  });

  it('GET /:id for non-existent returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/policies/${randomUUID()}`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ error: string }>().error).toMatch(/not found/i);
  });

  // ---- GET /api/policies ---------------------------------------------------

  it('GET list by tenantId returns matching policies', async () => {
    await createPolicy({ tenantId: 'team-alpha' });
    await createPolicy({ tenantId: 'team-beta', id: randomUUID(), name: 'Beta Policy' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/policies?tenantId=team-alpha',
    });
    expect(res.statusCode).toBe(200);
    const list = res.json<Array<{ tenantId: string }>>();
    expect(list.every((p) => p.tenantId === 'team-alpha')).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('GET list without tenantId returns 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/policies' });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/tenantId/);
  });

  it('multiple policies for the same tenant are all returned', async () => {
    const tenant = 'team-multi';
    await createPolicy({ tenantId: tenant, id: randomUUID(), name: 'Policy One' });
    await createPolicy({ tenantId: tenant, id: randomUUID(), name: 'Policy Two' });
    await createPolicy({ tenantId: tenant, id: randomUUID(), name: 'Policy Three' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/policies?tenantId=${tenant}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<unknown[]>().length).toBe(3);
  });

  // ---- PUT /api/policies/:id -----------------------------------------------

  it('PUT /:id updates the policy and returns the updated record', async () => {
    const { body } = await createPolicy();
    const updated = makePolicy({
      ...body,
      name: 'Updated Policy Name',
      updatedAt: '2026-06-01T00:00:00.000Z',
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/policies/${body['id'] as string}`,
      payload: updated,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ name: string }>().name).toBe('Updated Policy Name');
  });

  it('PUT /:id with invalid data returns 400', async () => {
    const { body } = await createPolicy();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/policies/${body['id'] as string}`,
      payload: { name: 'No rules provided' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PUT /:id for non-existent returns 404', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/policies/${randomUUID()}`,
      payload: makePolicy(),
    });
    expect(res.statusCode).toBe(404);
  });

  // ---- DELETE /api/policies/:id --------------------------------------------

  it('DELETE /:id removes the policy and returns 204', async () => {
    const { body } = await createPolicy();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/policies/${body['id'] as string}`,
    });
    expect(res.statusCode).toBe(204);

    // Confirm it no longer exists
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/policies/${body['id'] as string}`,
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('DELETE /:id for non-existent returns 404', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/policies/${randomUUID()}`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ error: string }>().error).toMatch(/not found/i);
  });

  it('policy createdAt timestamp is preserved on update', async () => {
    const { body } = await createPolicy({ createdAt: NOW });
    const updated = makePolicy({
      ...body,
      name: 'Updated Name',
      createdAt: NOW,
      updatedAt: '2026-07-01T00:00:00.000Z',
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/policies/${body['id'] as string}`,
      payload: updated,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ createdAt: string }>().createdAt).toBe(NOW);
  });
});
