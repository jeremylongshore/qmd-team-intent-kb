import { describe, it, expect, beforeEach } from 'vitest';
import type { MemoryRepository } from '@qmd-team-intent-kb/store';
import { aggregateLifecycle } from '../aggregators/lifecycle-aggregator.js';
import { createTestRepos, makeMemory } from './fixtures.js';

describe('aggregateLifecycle', () => {
  let memoryRepo: MemoryRepository;

  beforeEach(() => {
    ({ memoryRepo } = createTestRepos());
  });

  it('returns zero counts for all states when DB is empty', () => {
    const report = aggregateLifecycle(memoryRepo);
    expect(report.total).toBe(0);
    expect(report.activeRate).toBe(0);
    expect(report.distribution['active']).toBe(0);
    expect(report.distribution['deprecated']).toBe(0);
    expect(report.distribution['superseded']).toBe(0);
    expect(report.distribution['archived']).toBe(0);
  });

  it('counts memories by lifecycle state', () => {
    memoryRepo.insert(makeMemory({ lifecycle: 'active' }));
    memoryRepo.insert(makeMemory({ lifecycle: 'active' }));
    memoryRepo.insert(makeMemory({ lifecycle: 'deprecated' }));
    memoryRepo.insert(makeMemory({ lifecycle: 'archived' }));

    const report = aggregateLifecycle(memoryRepo);
    expect(report.distribution['active']).toBe(2);
    expect(report.distribution['deprecated']).toBe(1);
    expect(report.distribution['superseded']).toBe(0);
    expect(report.distribution['archived']).toBe(1);
    expect(report.total).toBe(4);
  });

  it('calculates active rate correctly', () => {
    memoryRepo.insert(makeMemory({ lifecycle: 'active' }));
    memoryRepo.insert(makeMemory({ lifecycle: 'active' }));
    memoryRepo.insert(makeMemory({ lifecycle: 'active' }));
    memoryRepo.insert(makeMemory({ lifecycle: 'archived' }));

    const report = aggregateLifecycle(memoryRepo);
    expect(report.activeRate).toBe(0.75);
  });

  it('fills zero for states not present in data', () => {
    memoryRepo.insert(makeMemory({ lifecycle: 'active' }));

    const report = aggregateLifecycle(memoryRepo);
    expect(report.distribution['superseded']).toBe(0);
    expect(report.distribution['archived']).toBe(0);
    expect(report.distribution['deprecated']).toBe(0);
  });
});
