import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { createTestDatabase, AuditRepository } from '@qmd-team-intent-kb/store';
import type { AuditEvent } from '@qmd-team-intent-kb/schema';
import { buildApp } from '../app.js';
import { NOW } from './fixtures.js';

describe('GET /api/audit', () => {
  let db: Database.Database;
  let app: FastifyInstance;
  let auditRepo: AuditRepository;

  function makeEvent(overrides?: Partial<AuditEvent>): AuditEvent {
    return {
      id: randomUUID(),
      action: 'promoted',
      memoryId: randomUUID(),
      tenantId: 'team-alpha',
      actor: { type: 'human', id: 'user-1', name: 'Test User' },
      reason: 'Passed all governance rules',
      details: {},
      timestamp: NOW,
      ...overrides,
    };
  }

  beforeEach(async () => {
    db = createTestDatabase();
    auditRepo = new AuditRepository(db);
    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('returns empty array when no events match', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit?tenantId=nobody',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns events filtered by tenantId', async () => {
    auditRepo.insert(makeEvent({ tenantId: 'team-alpha', action: 'promoted' }));
    auditRepo.insert(makeEvent({ tenantId: 'team-beta', action: 'archived' }));

    const res = await app.inject({
      method: 'GET',
      url: '/api/audit?tenantId=team-alpha',
    });
    expect(res.statusCode).toBe(200);
    const events = res.json<Array<{ tenantId: string }>>();
    expect(events.every((e) => e.tenantId === 'team-alpha')).toBe(true);
    expect(events.length).toBe(1);
  });

  it('returns events filtered by memoryId', async () => {
    const memoryId = randomUUID();
    auditRepo.insert(makeEvent({ memoryId, action: 'promoted' }));
    auditRepo.insert(makeEvent({ memoryId, action: 'demoted' }));
    auditRepo.insert(makeEvent({ memoryId: randomUUID(), action: 'archived' }));

    const res = await app.inject({
      method: 'GET',
      url: `/api/audit?memoryId=${memoryId}`,
    });
    expect(res.statusCode).toBe(200);
    const events = res.json<Array<{ memoryId: string }>>();
    expect(events.every((e) => e.memoryId === memoryId)).toBe(true);
    expect(events.length).toBe(2);
  });

  it('returns events filtered by action', async () => {
    auditRepo.insert(makeEvent({ action: 'promoted' }));
    auditRepo.insert(makeEvent({ action: 'archived' }));
    auditRepo.insert(makeEvent({ action: 'promoted', memoryId: randomUUID() }));

    const res = await app.inject({
      method: 'GET',
      url: '/api/audit?action=promoted',
    });
    expect(res.statusCode).toBe(200);
    const events = res.json<Array<{ action: string }>>();
    expect(events.every((e) => e.action === 'promoted')).toBe(true);
    expect(events.length).toBe(2);
  });

  it('multiple events for the same memory are all returned', async () => {
    const memoryId = randomUUID();
    auditRepo.insert(makeEvent({ memoryId, action: 'promoted' }));
    auditRepo.insert(makeEvent({ memoryId, action: 'demoted' }));
    auditRepo.insert(makeEvent({ memoryId, action: 'archived' }));

    const res = await app.inject({
      method: 'GET',
      url: `/api/audit?memoryId=${memoryId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<unknown[]>().length).toBe(3);
  });

  it('memoryId filter takes precedence over tenantId when both provided', async () => {
    const memoryId = randomUUID();
    // This event has a different tenant but the memoryId matches
    auditRepo.insert(makeEvent({ memoryId, tenantId: 'team-other', action: 'archived' }));
    auditRepo.insert(makeEvent({ tenantId: 'team-alpha', action: 'promoted' }));

    const res = await app.inject({
      method: 'GET',
      url: `/api/audit?memoryId=${memoryId}&tenantId=team-alpha`,
    });
    const events = res.json<Array<{ memoryId: string }>>();
    // memoryId wins — only the event with that memoryId is returned
    expect(events.every((e) => e.memoryId === memoryId)).toBe(true);
    expect(events.length).toBe(1);
  });
});
