import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { createTestDatabase } from '../database.js';
import { MemoryRepository } from '../repositories/memory-repository.js';
import { makeMemory, HASH_A, HASH_B } from './fixtures.js';

const NOW = '2026-01-15T10:00:00.000Z';
const LATER = '2026-02-01T12:00:00.000Z';

describe('MemoryRepository', () => {
  let db: Database.Database;
  let repo: MemoryRepository;

  beforeEach(() => {
    db = createTestDatabase();
    repo = new MemoryRepository(db);
  });

  it('inserts a memory and retrieves it by id', () => {
    const memory = makeMemory();
    repo.insert(memory);
    const found = repo.findById(memory.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(memory.id);
    expect(found?.content).toBe(memory.content);
    expect(found?.lifecycle).toBe('active');
  });

  it('findByTenant returns only memories for the matching tenant', () => {
    const m1 = makeMemory({ tenantId: 'team-alpha' });
    const m2 = makeMemory({ tenantId: 'team-beta', contentHash: HASH_B });
    repo.insert(m1);
    repo.insert(m2);

    const alphaResults = repo.findByTenant('team-alpha');
    expect(alphaResults).toHaveLength(1);
    expect(alphaResults[0]?.tenantId).toBe('team-alpha');

    const betaResults = repo.findByTenant('team-beta');
    expect(betaResults).toHaveLength(1);
    expect(betaResults[0]?.tenantId).toBe('team-beta');
  });

  it('findByContentHash returns the matching memory', () => {
    const memory = makeMemory({ contentHash: HASH_A });
    repo.insert(memory);
    const found = repo.findByContentHash(HASH_A);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(memory.id);
  });

  it('findByLifecycle filters correctly to requested state', () => {
    const active = makeMemory({ lifecycle: 'active' });
    const deprecated = makeMemory({ lifecycle: 'deprecated', contentHash: HASH_B });
    repo.insert(active);
    repo.insert(deprecated);

    const activeResults = repo.findByLifecycle('active');
    expect(activeResults).toHaveLength(1);
    expect(activeResults[0]?.lifecycle).toBe('active');

    const deprecatedResults = repo.findByLifecycle('deprecated');
    expect(deprecatedResults).toHaveLength(1);
    expect(deprecatedResults[0]?.lifecycle).toBe('deprecated');
  });

  it('updateLifecycle changes the lifecycle state and returns true', () => {
    const memory = makeMemory({ lifecycle: 'active' });
    repo.insert(memory);
    const updated = repo.updateLifecycle(memory.id, 'deprecated', LATER);
    expect(updated).toBe(true);
    const found = repo.findById(memory.id);
    expect(found?.lifecycle).toBe('deprecated');
    expect(found?.updatedAt).toBe(LATER);
  });

  it('update performs a full record update and returns true', () => {
    const memory = makeMemory();
    repo.insert(memory);
    const updatedMemory = { ...memory, title: 'Updated title', version: 2, updatedAt: LATER };
    const result = repo.update(updatedMemory);
    expect(result).toBe(true);
    const found = repo.findById(memory.id);
    expect(found?.title).toBe('Updated title');
    expect(found?.version).toBe(2);
    expect(found?.updatedAt).toBe(LATER);
  });

  it('count returns the correct number of memories', () => {
    expect(repo.count()).toBe(0);
    repo.insert(makeMemory({ contentHash: HASH_A }));
    expect(repo.count()).toBe(1);
    repo.insert(makeMemory({ contentHash: HASH_B }));
    expect(repo.count()).toBe(2);
  });

  it('getAllContentHashes returns all stored hashes', () => {
    repo.insert(makeMemory({ contentHash: HASH_A }));
    repo.insert(makeMemory({ contentHash: HASH_B }));
    const hashes = repo.getAllContentHashes();
    expect(hashes).toHaveLength(2);
    expect(hashes).toContain(HASH_A);
    expect(hashes).toContain(HASH_B);
  });

  it('returns null for a non-existent id', () => {
    expect(repo.findById(randomUUID())).toBeNull();
  });

  it('multiple memories with different lifecycles are all retrievable', () => {
    const states = ['active', 'deprecated', 'archived'] as const;
    const hashes = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)] as const;
    states.forEach((lifecycle, i) => {
      repo.insert(makeMemory({ lifecycle, contentHash: hashes[i] }));
    });
    expect(repo.count()).toBe(3);
    expect(repo.findByLifecycle('active')).toHaveLength(1);
    expect(repo.findByLifecycle('deprecated')).toHaveLength(1);
    expect(repo.findByLifecycle('archived')).toHaveLength(1);
    expect(repo.findByLifecycle('superseded')).toHaveLength(0);
  });

  it('preserves policyEvaluations and supersession on round-trip', () => {
    const supersessionLink = {
      supersededBy: randomUUID(),
      reason: 'Replaced by newer version',
      linkedAt: NOW,
    };
    const policyEvaluations = [
      {
        policyId: randomUUID(),
        ruleId: 'rule-1',
        result: 'pass' as const,
        reason: 'Passed check',
        evaluatedAt: NOW,
      },
    ];
    const memory = makeMemory({
      lifecycle: 'superseded',
      supersession: supersessionLink,
      policyEvaluations,
      contentHash: HASH_B,
    });
    repo.insert(memory);
    const found = repo.findById(memory.id);
    expect(found?.supersession?.reason).toBe('Replaced by newer version');
    expect(found?.policyEvaluations).toHaveLength(1);
    expect(found?.policyEvaluations[0]?.result).toBe('pass');
  });
});
