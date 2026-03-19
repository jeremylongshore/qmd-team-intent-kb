import type { MemoryRepository } from '@qmd-team-intent-kb/store';
import type { KnowledgeHealthReport } from '../types.js';

/** All known categories — used to fill zeros for missing categories */
const CATEGORIES = [
  'decision',
  'pattern',
  'convention',
  'architecture',
  'troubleshooting',
  'onboarding',
  'reference',
] as const;

/**
 * Analyze knowledge health: staleness, category coverage, freshness score.
 *
 * @param staleDays - Number of days without update to consider a memory stale (default 30)
 * @param nowFn - Injectable clock for testing
 */
export function aggregateKnowledgeHealth(
  memoryRepo: MemoryRepository,
  staleDays: number = 30,
  nowFn: () => string = () => new Date().toISOString(),
): KnowledgeHealthReport {
  const now = new Date(nowFn());
  const threshold = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);
  const olderThan = threshold.toISOString();

  const staleMemories = memoryRepo.findStale(olderThan);
  const staleCount = staleMemories.length;
  const staleIds = staleMemories.map((m) => m.id);

  // Category coverage: count only active memories
  const rawCategoryCounts = memoryRepo.countByCategory();
  const categoryCoverage: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    categoryCoverage[cat] = rawCategoryCounts[cat] ?? 0;
  }

  // Total active = count of memories in 'active' lifecycle
  const lifecycleCounts = memoryRepo.countByLifecycle();
  const totalActive = lifecycleCounts['active'] ?? 0;

  // Freshness: 1 - (stale/active), clamped to [0, 1]
  const freshnessScore =
    totalActive > 0 ? Math.max(0, Math.min(1, 1 - staleCount / totalActive)) : 1;

  return { staleCount, staleIds, categoryCoverage, freshnessScore, totalActive };
}
