import type { MemoryRepository } from '@qmd-team-intent-kb/store';
import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';

/** A curated memory that may be superseded by the incoming candidate */
export interface SupersessionMatch {
  supersededMemoryId: string;
  supersededTitle: string;
  similarity: number;
}

/**
 * Detects whether an incoming candidate should supersede an existing active
 * curated memory, using Jaccard similarity on title word tokens within the
 * same category and tenant.
 *
 * Only active memories in the same category as the candidate are considered.
 * When multiple memories meet the threshold the one with the highest similarity
 * is returned; ties are broken by whichever was found first.
 *
 * @param threshold - Minimum Jaccard similarity (0.0–1.0) to consider a match.
 *                   Defaults to 0.6.
 * @returns The best-matching memory above the threshold, or null if none found.
 */
export function detectSupersession(
  candidate: MemoryCandidate,
  memoryRepo: MemoryRepository,
  threshold: number = 0.6,
): SupersessionMatch | null {
  const existingMemories = memoryRepo
    .findByTenant(candidate.tenantId)
    .filter((m) => m.lifecycle === 'active' && m.category === candidate.category);

  let bestMatch: SupersessionMatch | null = null;

  for (const memory of existingMemories) {
    const similarity = computeTitleSimilarity(candidate.title, memory.title);
    if (similarity >= threshold && (bestMatch === null || similarity > bestMatch.similarity)) {
      bestMatch = {
        supersededMemoryId: memory.id,
        supersededTitle: memory.title,
        similarity,
      };
    }
  }

  return bestMatch;
}

/**
 * Computes Jaccard similarity between two strings using word-level tokenization.
 *
 * Jaccard similarity = |intersection| / |union|
 *
 * Both strings are lower-cased and split on whitespace. Empty strings produce
 * 1.0 when both are empty (identical) and 0.0 when only one is empty.
 */
export function computeTitleSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}
