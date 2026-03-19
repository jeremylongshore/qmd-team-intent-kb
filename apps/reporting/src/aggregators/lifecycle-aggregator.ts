import type { MemoryRepository } from '@qmd-team-intent-kb/store';
import type { LifecycleReport } from '../types.js';

/** All known lifecycle states — used to fill zeros for missing states */
const LIFECYCLE_STATES = ['active', 'deprecated', 'superseded', 'archived'] as const;

/**
 * Aggregate lifecycle state distribution from the memory store.
 * Fills in zero counts for any states not represented in the data.
 */
export function aggregateLifecycle(memoryRepo: MemoryRepository): LifecycleReport {
  const rawCounts = memoryRepo.countByLifecycle();

  const distribution: Record<string, number> = {};
  let total = 0;

  for (const state of LIFECYCLE_STATES) {
    const count = rawCounts[state] ?? 0;
    distribution[state] = count;
    total += count;
  }

  const activeCount = distribution['active'] ?? 0;
  const activeRate = total > 0 ? activeCount / total : 0;

  return { distribution, total, activeRate };
}
