import { computeContentHash } from '@qmd-team-intent-kb/common';
import type { CandidateRepository, MemoryRepository } from '@qmd-team-intent-kb/store';

/** Where the collision was found */
export type CollisionTarget = 'curated_memory' | 'candidate';

/** Result of a collision check for a single file */
export interface CollisionResult {
  /** SHA-256 of the content (body only, frontmatter stripped) */
  contentHash: string;
  /** True when an existing record with the same content hash was found */
  hasCollision: boolean;
  /** Where the collision was found */
  target?: CollisionTarget;
  /** ID of the colliding record */
  matchedId?: string;
  /** Title of the colliding record (for display) */
  matchedTitle?: string;
}

/**
 * Check whether content already exists in curated memories or pending candidates.
 *
 * Priority: curated memory match > candidate match (curated is more authoritative).
 *
 * @param content - The file body (frontmatter already stripped)
 * @param memoryRepo - Curated memory repository
 * @param candidateRepo - Candidate (inbox) repository
 * @param batchHashes - Optional set of hashes already seen in the current batch
 * @returns CollisionResult with hash and match details
 */
export function detectCollision(
  content: string,
  memoryRepo: MemoryRepository,
  candidateRepo: CandidateRepository,
  batchHashes?: Set<string>,
): CollisionResult {
  const contentHash = computeContentHash(content);

  // Intra-batch collision (same content already processed in this import)
  if (batchHashes?.has(contentHash)) {
    return {
      contentHash,
      hasCollision: true,
      target: 'candidate',
      matchedTitle: '(duplicate within this import batch)',
    };
  }

  // Check curated memories first (most authoritative)
  const curatedMatch = memoryRepo.findByContentHash(contentHash);
  if (curatedMatch !== null) {
    return {
      contentHash,
      hasCollision: true,
      target: 'curated_memory',
      matchedId: curatedMatch.id,
      matchedTitle: curatedMatch.title,
    };
  }

  // Check pending candidates
  const candidateMatch = candidateRepo.findByContentHash(contentHash);
  if (candidateMatch !== null) {
    return {
      contentHash,
      hasCollision: true,
      target: 'candidate',
      matchedId: candidateMatch.id,
      matchedTitle: candidateMatch.title,
    };
  }

  return { contentHash, hasCollision: false };
}
