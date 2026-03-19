import { describe, it, expect, beforeEach } from 'vitest';
import type { MemoryRepository } from '@qmd-team-intent-kb/store';
import { aggregateKnowledgeHealth } from '../aggregators/knowledge-health-aggregator.js';
import { createTestRepos, makeMemory } from './fixtures.js';

const FIXED_NOW = '2026-03-01T00:00:00.000Z';
const RECENT = '2026-02-20T00:00:00.000Z'; // 9 days old
const OLD = '2026-01-01T00:00:00.000Z'; // 59 days old

describe('aggregateKnowledgeHealth', () => {
  let memoryRepo: MemoryRepository;

  beforeEach(() => {
    ({ memoryRepo } = createTestRepos());
  });

  it('returns zero stale and perfect freshness for empty DB', () => {
    const report = aggregateKnowledgeHealth(memoryRepo, 30, () => FIXED_NOW);
    expect(report.staleCount).toBe(0);
    expect(report.staleIds).toEqual([]);
    expect(report.freshnessScore).toBe(1);
    expect(report.totalActive).toBe(0);
  });

  it('detects stale memories based on staleDays threshold', () => {
    const stale = makeMemory({ lifecycle: 'active', updatedAt: OLD });
    const fresh = makeMemory({ lifecycle: 'active', updatedAt: RECENT });
    memoryRepo.insert(stale);
    memoryRepo.insert(fresh);

    const report = aggregateKnowledgeHealth(memoryRepo, 30, () => FIXED_NOW);
    expect(report.staleCount).toBe(1);
    expect(report.staleIds).toContain(stale.id);
    expect(report.staleIds).not.toContain(fresh.id);
  });

  it('excludes non-active memories from stale detection', () => {
    const archivedOld = makeMemory({ lifecycle: 'archived', updatedAt: OLD });
    memoryRepo.insert(archivedOld);

    const report = aggregateKnowledgeHealth(memoryRepo, 30, () => FIXED_NOW);
    expect(report.staleCount).toBe(0);
  });

  it('calculates freshness score correctly', () => {
    memoryRepo.insert(makeMemory({ lifecycle: 'active', updatedAt: OLD }));
    memoryRepo.insert(makeMemory({ lifecycle: 'active', updatedAt: OLD }));
    memoryRepo.insert(makeMemory({ lifecycle: 'active', updatedAt: RECENT }));
    memoryRepo.insert(makeMemory({ lifecycle: 'active', updatedAt: RECENT }));

    const report = aggregateKnowledgeHealth(memoryRepo, 30, () => FIXED_NOW);
    expect(report.totalActive).toBe(4);
    expect(report.staleCount).toBe(2);
    expect(report.freshnessScore).toBe(0.5);
  });

  it('fills zero for missing categories', () => {
    memoryRepo.insert(makeMemory({ lifecycle: 'active', category: 'pattern' }));

    const report = aggregateKnowledgeHealth(memoryRepo, 30, () => FIXED_NOW);
    expect(report.categoryCoverage['pattern']).toBe(1);
    expect(report.categoryCoverage['decision']).toBe(0);
    expect(report.categoryCoverage['architecture']).toBe(0);
  });
});
