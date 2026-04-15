import { join } from 'node:path';
import type { Result } from '@qmd-team-intent-kb/common';
import { getFailedPath, getSpoolFilename } from '../config.js';
import { writeJsonlRecord } from './write-jsonl.js';

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

  return writeJsonlRecord(dir, filepath, record, 'Failed to write to failure bucket');
}
