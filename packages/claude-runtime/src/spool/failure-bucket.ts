import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Result } from '@qmd-team-intent-kb/common';
import { getFailedPath, getSpoolFilename } from '../config.js';

/** Record of a failed candidate with reason */
export interface FailureRecord {
  candidateInput: unknown;
  error: string;
  failedAt: string;
}

/** Route a failed candidate to the failure bucket */
export async function writeToFailureBucket(
  candidateInput: unknown,
  error: string,
  failedDir?: string,
): Promise<Result<string, string>> {
  const dir = failedDir ?? getFailedPath();
  const filename = `failed-${getSpoolFilename().replace('spool-', '')}`;
  const filepath = join(dir, filename);

  const record: FailureRecord = {
    candidateInput,
    error,
    failedAt: new Date().toISOString(),
  };

  try {
    await mkdir(dir, { recursive: true });
    await appendFile(filepath, JSON.stringify(record) + '\n', 'utf8');
    return { ok: true, value: filepath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to write to failure bucket: ${msg}` };
  }
}
