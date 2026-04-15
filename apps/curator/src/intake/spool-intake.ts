import { readSpoolFile, listSpoolFiles } from '@qmd-team-intent-kb/claude-runtime';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import type { Result } from '@qmd-team-intent-kb/common';
import type { CandidateRepository } from '@qmd-team-intent-kb/store';
import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';

/**
 * Reads spool files from the given directory (or default spool path) and inserts
 * new candidates into the candidate repository.
 *
 * Deduplication is ID-based: if a candidate with the same ID already exists in
 * the store it is silently skipped to prevent re-ingestion on repeated runs.
 * Unreadable or malformed spool files are skipped without aborting the batch.
 *
 * @returns ok with the list of newly-ingested candidates, or err if the spool
 *          directory itself cannot be accessed.
 */
export async function ingestFromSpool(
  candidateRepo: CandidateRepository,
  spoolDir?: string,
): Promise<Result<MemoryCandidate[], string>> {
  const filesResult = await listSpoolFiles(spoolDir);
  if (!filesResult.ok) return filesResult;

  const ingested: MemoryCandidate[] = [];

  for (const filepath of filesResult.value) {
    const readResult = await readSpoolFile(filepath);
    if (!readResult.ok) continue; // skip unreadable files, keep processing others

    for (const candidate of readResult.value) {
      const existing = candidateRepo.findById(candidate.id);
      if (existing !== null) continue;

      const hash = computeContentHash(candidate.content);
      candidateRepo.insert(candidate, hash);
      ingested.push(candidate);
    }
  }

  return { ok: true, value: ingested };
}
