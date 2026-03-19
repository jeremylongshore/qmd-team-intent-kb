import { computeContentHash } from '@qmd-team-intent-kb/common';
import type { MemoryRepository } from '@qmd-team-intent-kb/store';
import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';

/** Result of a duplicate check against the curated memory store */
export interface DedupResult {
  isDuplicate: boolean;
  /** ID of the existing curated memory that matched, when isDuplicate is true */
  matchedMemoryId?: string;
  matchType?: 'exact_hash';
  contentHash: string;
}

/**
 * Two-tier deduplication check:
 *   1. Exact SHA-256 content hash match against curated memories (definitive)
 *   2. (Future) qmd similarity search — flagging only, not implemented here
 *
 * Returns a DedupResult with isDuplicate=true when an exact match is found,
 * or isDuplicate=false for novel content. The contentHash is always populated
 * so callers can reuse it without re-computing.
 */
export function checkDuplicate(
  candidate: MemoryCandidate,
  memoryRepo: MemoryRepository,
): DedupResult {
  const contentHash = computeContentHash(candidate.content);
  const existing = memoryRepo.findByContentHash(contentHash);

  if (existing !== null) {
    return {
      isDuplicate: true,
      matchedMemoryId: existing.id,
      matchType: 'exact_hash',
      contentHash,
    };
  }

  return { isDuplicate: false, contentHash };
}
