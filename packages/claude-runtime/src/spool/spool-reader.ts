import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import type { Result } from '@qmd-team-intent-kb/common';
import { getSpoolPath } from '../config.js';

/** Read and parse all candidates from a single spool file */
export async function readSpoolFile(filepath: string): Promise<Result<MemoryCandidate[], string>> {
  try {
    const content = await readFile(filepath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const candidates: MemoryCandidate[] = [];

    for (const line of lines) {
      const parsed = MemoryCandidate.safeParse(JSON.parse(line));
      if (parsed.success) {
        candidates.push(parsed.data);
      }
    }

    return { ok: true, value: candidates };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to read spool file: ${msg}` };
  }
}

/** List all spool files in the spool directory */
export async function listSpoolFiles(spoolDir?: string): Promise<Result<string[], string>> {
  const dir = spoolDir ?? getSpoolPath();
  try {
    const files = await readdir(dir);
    const spoolFiles = files
      .filter((f) => f.startsWith('spool-') && f.endsWith('.jsonl'))
      .sort()
      .map((f) => join(dir, f));
    return { ok: true, value: spoolFiles };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to list spool files: ${msg}` };
  }
}
