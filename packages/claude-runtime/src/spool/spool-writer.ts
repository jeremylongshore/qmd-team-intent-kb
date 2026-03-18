import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Result } from '@qmd-team-intent-kb/common';
import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import { getSpoolPath, getSpoolFilename } from '../config.js';

/** Append a memory candidate to the daily JSONL spool file */
export async function writeToSpool(
  candidate: MemoryCandidate,
  spoolDir?: string,
): Promise<Result<string, string>> {
  const dir = spoolDir ?? getSpoolPath();
  const filename = getSpoolFilename();
  const filepath = join(dir, filename);

  try {
    await mkdir(dir, { recursive: true });
    const line = JSON.stringify(candidate) + '\n';
    await appendFile(filepath, line, 'utf8');
    return { ok: true, value: filepath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to write to spool: ${msg}` };
  }
}
