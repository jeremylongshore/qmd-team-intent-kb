import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import type { DaemonLogger } from './types.js';

/** Result of a repo-scope filter pass */
interface RepoScopeResult {
  kept: MemoryCandidate[];
  skipped: number;
  /**
   * Candidates kept despite having no `metadata.repoUrl`. They bypassed
   * scoping entirely — the flag's isolation is weaker than the name implies.
   * Operators enabling `scopeByRepo=true` need visibility into how many
   * candidates are unscoped per cycle.
   */
  unscoped: number;
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
  let unscoped = 0;

  for (const candidate of candidates) {
    const candidateUrl = candidate.metadata.repoUrl;

    if (!candidateUrl) {
      kept.push(candidate);
      unscoped++;
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

  if (unscoped > 0) {
    logger.info(`[repo-scope] ${unscoped} candidate(s) kept without repoUrl (bypassed scoping)`);
  }

  return { kept, skipped, unscoped };
}

/** Normalize a remote URL for comparison: trim whitespace, strip trailing .git */
function normalizeUrl(url: string): string {
  return url
    .trim()
    .replace(/\.git$/, '')
    .toLowerCase();
}
