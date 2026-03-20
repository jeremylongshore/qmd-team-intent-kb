import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { glob } from 'node:fs/promises';
import type { MemoryCandidate } from '@qmd-team-intent-kb/schema';
import { writeToSpool } from '@qmd-team-intent-kb/claude-runtime';
import { categorizeFromPath } from '../categorize.js';
import type { McpServerConfig } from '../config.js';

/** Input for teamkb_import */
export interface ImportInput {
  glob: string;
  basePath?: string;
}

/** Per-file import outcome */
export interface FileImportOutcome {
  file: string;
  candidateId: string;
  ok: boolean;
  error?: string;
}

/** Aggregate result for teamkb_import */
export interface ImportResult {
  queued: number;
  failed: number;
  outcomes: FileImportOutcome[];
}

/**
 * Derive a human-readable title from a file path.
 * Strips extension, replaces hyphens/underscores with spaces, title-cases.
 */
function titleFromPath(filePath: string): string {
  const name = basename(filePath, extname(filePath));
  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Import matching files from the filesystem as memory candidates.
 *
 * One candidate is written to the spool per matching file. Files that cannot
 * be read (permissions, binary, etc.) are reported as failures without
 * halting the rest of the import.
 *
 * Uses node:fs/promises glob (Node 22+). Falls back gracefully when no files
 * match.
 */
export async function importFiles(
  input: ImportInput,
  config: McpServerConfig,
  nowFn: () => string = () => new Date().toISOString(),
): Promise<ImportResult> {
  const base = input.basePath ?? process.cwd();
  const pattern = join(base, input.glob);

  let matchedFiles: string[];
  try {
    const iter = glob(pattern);
    matchedFiles = [];
    for await (const file of iter) {
      matchedFiles.push(file);
    }
  } catch {
    matchedFiles = [];
  }

  const outcomes: FileImportOutcome[] = [];
  let queued = 0;
  let failed = 0;

  for (const file of matchedFiles) {
    const candidateId = randomUUID();
    let content: string;

    try {
      content = await readFile(file, 'utf8');
    } catch (e) {
      outcomes.push({
        file,
        candidateId,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
      failed++;
      continue;
    }

    if (!content.trim()) {
      outcomes.push({ file, candidateId, ok: false, error: 'File is empty' });
      failed++;
      continue;
    }

    const candidate: MemoryCandidate = {
      id: candidateId,
      status: 'inbox',
      source: 'import',
      content: content.trim(),
      title: titleFromPath(file),
      category: categorizeFromPath(file),
      trustLevel: 'medium',
      author: { type: 'ai', id: 'mcp-import' },
      tenantId: config.tenantId,
      metadata: {
        filePaths: [file],
        tags: [],
      },
      prePolicyFlags: {
        potentialSecret: false,
        lowConfidence: false,
        duplicateSuspect: false,
      },
      capturedAt: nowFn(),
    };

    const writeResult = await writeToSpool(candidate, config.spoolPath);

    if (writeResult.ok) {
      outcomes.push({ file, candidateId, ok: true });
      queued++;
    } else {
      outcomes.push({ file, candidateId, ok: false, error: writeResult.error });
      failed++;
    }
  }

  return { queued, failed, outcomes };
}
