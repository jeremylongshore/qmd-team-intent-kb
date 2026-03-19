import type { MemoryRepository, ExportStateRepository } from '@qmd-team-intent-kb/store';
import type { CuratedMemory } from '@qmd-team-intent-kb/schema';
import type { ExportChangeset, ExportConfig } from '../types.js';
import { getRelativePath, getCategoryDirectory } from '../formatter/directory-mapper.js';
import { join } from 'node:path';

/**
 * Detect what has changed since the last export and build a changeset.
 *
 * - First run (no export state): returns all memories across all lifecycle states.
 * - Subsequent runs: only memories whose `updatedAt` is strictly after `lastExportedAt`.
 *
 * Active / deprecated memories → `toWrite`
 * Archived / superseded memories → `toArchive` (move from category dir to archive/)
 */
export function detectChanges(
  memoryRepo: MemoryRepository,
  exportStateRepo: ExportStateRepository,
  config: ExportConfig,
): ExportChangeset {
  const exportState = exportStateRepo.get(config.targetId);

  let memories: CuratedMemory[];

  if (config.tenantId !== undefined) {
    memories = memoryRepo.findByTenant(config.tenantId);
  } else {
    const active = memoryRepo.findByLifecycle('active');
    const deprecated = memoryRepo.findByLifecycle('deprecated');
    const superseded = memoryRepo.findByLifecycle('superseded');
    const archived = memoryRepo.findByLifecycle('archived');
    memories = [...active, ...deprecated, ...superseded, ...archived];
  }

  if (exportState !== null) {
    memories = memories.filter((m) => m.updatedAt > exportState.lastExportedAt);
  }

  const toWrite: ExportChangeset['toWrite'] = [];
  const toArchive: ExportChangeset['toArchive'] = [];

  for (const memory of memories) {
    if (memory.lifecycle === 'archived' || memory.lifecycle === 'superseded') {
      // File may currently live in its category directory (from when it was active).
      const categoryDir = getCategoryDirectory(memory.category);
      const fromPath = join(config.outputDir, categoryDir, `${memory.id}.md`);
      const toPath = join(config.outputDir, getRelativePath(memory));
      toArchive.push({ memory, fromPath, toPath });
    } else {
      const filePath = join(config.outputDir, getRelativePath(memory));
      toWrite.push({ memory, filePath });
    }
  }

  return { toWrite, toArchive, toRemove: [] };
}
