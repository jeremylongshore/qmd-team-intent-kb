import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import type { DaemonLogger } from './types.js';

/** Result of a repo-scope filter pass */
interface RepoScopeResult {
  kept: MemoryCandidate[];
  skipped: number;
}

/**
 * Filter candidates to only those whose `metadata.repoUrl` matches
 * `expectedRemoteUrl`. Candidates with no `repoUrl` in metadata are kept
 * (they pre-date repo tagging and cannot be scoped out).
 *
 * Called only when `scopeByRepo` is enabled and the resolver returned a
 * non-null remoteUrl. Pure function — no I/O.
 */
export function filterByRepoScope(
  candidates: MemoryCandidate[],
  expectedRemoteUrl: string,
  logger: DaemonLogger,
): RepoScopeResult {
  const kept: MemoryCandidate[] = [];
  let skipped = 0;

  for (const candidate of candidates) {
    const candidateUrl = candidate.metadata.repoUrl;

    if (!candidateUrl) {
      kept.push(candidate);
      continue;
    }

    if (normalizeUrl(candidateUrl) === normalizeUrl(expectedRemoteUrl)) {
      kept.push(candidate);
    } else {
      skipped++;
      logger.warn(
        `[repo-scope] Skipping candidate ${candidate.id}: repoUrl "${candidateUrl}" does not match daemon repo "${expectedRemoteUrl}"`,
      );
    }
  }

  return { kept, skipped };
}

/** Normalize a remote URL for comparison: trim whitespace, strip trailing .git */
function normalizeUrl(url: string): string {
  return url
    .trim()
    .replace(/\.git$/, '')
    .toLowerCase();
}
