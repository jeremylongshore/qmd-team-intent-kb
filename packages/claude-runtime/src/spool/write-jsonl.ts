import { mkdir, appendFile } from 'node:fs/promises';
import type { Result } from '@qmd-team-intent-kb/common';

/**
 * Append a single serialisable record as a JSONL line to `filepath`.
 * Creates the parent directory if it does not exist.
 *
 * Returns the absolute path on success, or an error string on failure.
 * The `errorPrefix` is prepended to the caught error message so callers
 * can produce context-specific error strings without duplicating the
 * try/catch boilerplate.
 */
export async function writeJsonlRecord(
  dir: string,
  filepath: string,
  record: unknown,
  errorPrefix: string,
): Promise<Result<string, string>> {
  try {
    await mkdir(dir, { recursive: true });
    await appendFile(filepath, JSON.stringify(record) + '\n', 'utf8');
    return { ok: true, value: filepath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `${errorPrefix}: ${msg}` };
  }
}
