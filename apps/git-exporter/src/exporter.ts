import type { MemoryRepository, ExportStateRepository } from '@qmd-team-intent-kb/store';
import type { ExportConfig, ExportResult } from './types.js';
import { detectChanges } from './diff/change-detector.js';
import { formatMemoryAsMarkdown } from './formatter/markdown-formatter.js';
import { writeFile, archiveFile, removeFile } from './writer/file-writer.js';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Main export orchestrator.
 *
 * Steps:
 * 1. Detect changes since last export
 * 2. Write new/updated files to their category directory
 * 3. Archive superseded/archived files to `archive/`
 * 4. Remove deleted files (changeset `toRemove`)
 * 5. Record the current timestamp as the new export state
 *
 * Idempotent: re-running when there are no changes produces no file writes.
 * Does NOT run `git commit` or `git push` — file generation only.
 *
 * @param nowFn - Optional injectable clock, defaults to `new Date().toISOString()`.
 *                Pass a deterministic value in tests to avoid real-time skew.
 */
export function runExport(
  memoryRepo: MemoryRepository,
  exportStateRepo: ExportStateRepository,
  config: ExportConfig,
  nowFn: () => string = () => new Date().toISOString(),
): ExportResult {
  const changeset = detectChanges(memoryRepo, exportStateRepo, config);

  const written: string[] = [];
  const archived: string[] = [];
  const removed: string[] = [];
  let unchanged = 0;

  // Write new/updated files
  for (const item of changeset.toWrite) {
    const content = formatMemoryAsMarkdown(item.memory);

    // Skip if the file already contains identical content (idempotency guard)
    if (existsSync(item.filePath)) {
      const existing = readFileSync(item.filePath, 'utf8');
      if (existing === content) {
        unchanged++;
        continue;
      }
    }

    writeFile(item.filePath, content);
    written.push(item.filePath);
  }

  // Move archived/superseded files from category dir → archive/
  for (const item of changeset.toArchive) {
    const content = formatMemoryAsMarkdown(item.memory);
    archiveFile(item.fromPath, item.toPath, content);
    archived.push(item.toPath);
  }

  // Remove explicitly deleted files
  for (const filePath of changeset.toRemove) {
    if (removeFile(filePath)) {
      removed.push(filePath);
    }
  }

  // Persist the new export state timestamp
  exportStateRepo.set(config.targetId, nowFn());

  return {
    written,
    archived,
    removed,
    unchanged,
    totalProcessed:
      changeset.toWrite.length + changeset.toArchive.length + changeset.toRemove.length,
  };
}
