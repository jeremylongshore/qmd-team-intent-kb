import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { createTestDatabase, MemoryRepository, AuditRepository } from '@qmd-team-intent-kb/store';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import type { CuratedMemory } from '@qmd-team-intent-kb/schema';
import { runStalenessSweep } from '../staleness.js';

const NOW = '2026-01-15T10:00:00.000Z';
const TENANT = 'team-alpha';
const OLD_DATE = '2025-06-01T00:00:00.000Z'; // ~7 months before NOW
const RECENT_DATE = '2026-01-10T00:00:00.000Z'; // 5 days before NOW

function makeStaleMemory(overrides?: Partial<CuratedMemory>): CuratedMemory {
  const content = overrides?.content ?? `Memory content ${randomUUID()}`;
  return {
    id: randomUUID(),
    candidateId: randomUUID(),
    source: 'claude_session',
    content,
    title: 'Test memory',
    category: 'pattern',
    trustLevel: 'high',
    sensitivity: 'internal',
    author: { type: 'human', id: 'user-1', name: 'Test User' },
    tenantId: TENANT,
    metadata: { filePaths: [], tags: [] },
    lifecycle: 'active',
    contentHash: computeContentHash(content),
    policyEvaluations: [],
    promotedAt: OLD_DATE,
    promotedBy: { type: 'human', id: 'user-1', name: 'Test User' },
    updatedAt: OLD_DATE,
    version: 1,
    ...overrides,
  } satisfies CuratedMemory;
}

describe('runStalenessSweep', () => {
  let db: Database.Database;
  let memoryRepo: MemoryRepository;
  let auditRepo: AuditRepository;

  beforeEach(() => {
    db = createTestDatabase();
    memoryRepo = new MemoryRepository(db);
    auditRepo = new AuditRepository(db);
  });

  it('deprecates active memories older than staleDays', () => {
    const memory = makeStaleMemory({ updatedAt: OLD_DATE });
    memoryRepo.insert(memory);

    const result = runStalenessSweep(
      memoryRepo,
      auditRepo,
      { tenantId: TENANT, staleDays: 90 },
      () => NOW,
    );

    expect(result.deprecated).toBe(1);
    const updated = memoryRepo.findById(memory.id);
    expect(updated?.lifecycle).toBe('deprecated');
  });

  it('does not deprecate recent active memories', () => {
    const memory = makeStaleMemory({ updatedAt: RECENT_DATE });
    memoryRepo.insert(memory);

    const result = runStalenessSweep(
      memoryRepo,
      auditRepo,
      { tenantId: TENANT, staleDays: 90 },
      () => NOW,
    );

    expect(result.deprecated).toBe(0);
    expect(result.scanned).toBe(0);
    const unchanged = memoryRepo.findById(memory.id);
    expect(unchanged?.lifecycle).toBe('active');
  });

  it('does not deprecate already deprecated memories', () => {
    const memory = makeStaleMemory({ updatedAt: OLD_DATE, lifecycle: 'deprecated' });
    memoryRepo.insert(memory);

    const result = runStalenessSweep(
      memoryRepo,
      auditRepo,
      { tenantId: TENANT, staleDays: 90 },
      () => NOW,
    );

    // findStale only returns active — deprecated row should not appear
    expect(result.scanned).toBe(0);
    expect(result.deprecated).toBe(0);
  });

  it('filters by tenantId — only deprecates matching tenant', () => {
    const ownMemory = makeStaleMemory({ tenantId: TENANT, updatedAt: OLD_DATE });
    const foreignMemory = makeStaleMemory({ tenantId: 'team-foreign', updatedAt: OLD_DATE });
    memoryRepo.insert(ownMemory);
    memoryRepo.insert(foreignMemory);

    const result = runStalenessSweep(
      memoryRepo,
      auditRepo,
      { tenantId: TENANT, staleDays: 90 },
      () => NOW,
    );

    expect(result.scanned).toBe(1);
    expect(result.deprecated).toBe(1);

    // Own memory deprecated, foreign untouched
    expect(memoryRepo.findById(ownMemory.id)?.lifecycle).toBe('deprecated');
    expect(memoryRepo.findById(foreignMemory.id)?.lifecycle).toBe('active');
  });

  it('creates an audit event for each deprecated memory', () => {
    const memory = makeStaleMemory({ updatedAt: OLD_DATE });
    memoryRepo.insert(memory);

    runStalenessSweep(memoryRepo, auditRepo, { tenantId: TENANT, staleDays: 90 }, () => NOW);

    const events = auditRepo.findByMemory(memory.id);
    expect(events).toHaveLength(1);
  });

  it('audit event has correct action and reason', () => {
    const memory = makeStaleMemory({ updatedAt: OLD_DATE });
    memoryRepo.insert(memory);

    runStalenessSweep(memoryRepo, auditRepo, { tenantId: TENANT, staleDays: 90 }, () => NOW);

    const events = auditRepo.findByMemory(memory.id);
    const event = events[0];
    expect(event?.action).toBe('demoted');
    expect(event?.reason).toContain('Auto-deprecated');
    expect(event?.reason).toContain('90');
    expect(event?.actor).toMatchObject({ type: 'system', id: 'staleness-daemon' });
  });

  it('returns correct scanned and deprecated counts', () => {
    const staleA = makeStaleMemory({ updatedAt: OLD_DATE });
    const staleB = makeStaleMemory({ updatedAt: OLD_DATE });
    const recent = makeStaleMemory({ updatedAt: RECENT_DATE });
    memoryRepo.insert(staleA);
    memoryRepo.insert(staleB);
    memoryRepo.insert(recent);

    const result = runStalenessSweep(
      memoryRepo,
      auditRepo,
      { tenantId: TENANT, staleDays: 90 },
      () => NOW,
    );

    expect(result.scanned).toBe(2);
    expect(result.deprecated).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('handles empty result when no stale memories exist', () => {
    const result = runStalenessSweep(
      memoryRepo,
      auditRepo,
      { tenantId: TENANT, staleDays: 90 },
      () => NOW,
    );

    expect(result.scanned).toBe(0);
    expect(result.deprecated).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('deprecates multiple stale memories in one sweep', () => {
    const memories = Array.from({ length: 5 }, () => makeStaleMemory({ updatedAt: OLD_DATE }));
    for (const m of memories) {
      memoryRepo.insert(m);
    }

    const result = runStalenessSweep(
      memoryRepo,
      auditRepo,
      { tenantId: TENANT, staleDays: 90 },
      () => NOW,
    );

    expect(result.scanned).toBe(5);
    expect(result.deprecated).toBe(5);

    for (const m of memories) {
      expect(memoryRepo.findById(m.id)?.lifecycle).toBe('deprecated');
    }

    const allEvents = auditRepo.findByTenant(TENANT);
    expect(allEvents).toHaveLength(5);
    expect(allEvents.every((e) => e.action === 'demoted')).toBe(true);
  });

  it('uses the staleDays config to compute the threshold correctly', () => {
    // Memory updated 45 days before NOW — should be stale at staleDays=30, fresh at staleDays=60
    const fortyFiveDaysAgo = new Date(
      new Date(NOW).getTime() - 45 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const memory = makeStaleMemory({ updatedAt: fortyFiveDaysAgo });
    memoryRepo.insert(memory);

    const staleResult = runStalenessSweep(
      memoryRepo,
      auditRepo,
      { tenantId: TENANT, staleDays: 30 },
      () => NOW,
    );
    expect(staleResult.deprecated).toBe(1);

    // Reset lifecycle to active so we can re-test
    memoryRepo.updateLifecycle(memory.id, 'active', NOW);

    const freshResult = runStalenessSweep(
      memoryRepo,
      auditRepo,
      { tenantId: TENANT, staleDays: 60 },
      () => NOW,
    );
    expect(freshResult.deprecated).toBe(0);
  });
});
