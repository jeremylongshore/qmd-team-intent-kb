import type { CuratedMemory } from '@qmd-team-intent-kb/schema';

export interface ExportConfig {
  /** Root directory for exported files (e.g., kb-export/) */
  outputDir: string;
  /** Identifier for this export target (e.g., 'kb-export-default') */
  targetId: string;
  /** Optional tenant filter */
  tenantId?: string;
}

export interface ExportResult {
  /** File paths written */
  written: string[];
  /** File paths moved to archive */
  archived: string[];
  /** File paths removed */
  removed: string[];
  /** Memory IDs skipped due to sensitivity restrictions */
  skipped: string[];
  /** Count of files that didn't need updating */
  unchanged: number;
  totalProcessed: number;
}

export interface FrontmatterData {
  id: string;
  title: string;
  category: string;
  lifecycle: string;
  trustLevel: string;
  sensitivity: string;
  tenantId: string;
  contentHash: string;
  /** "type:id" format */
  author: string;
  promotedAt: string;
  updatedAt: string;
  version: number;
  tags: string[];
  supersededBy?: string;
}

export interface ExportChangeset {
  toWrite: Array<{ memory: CuratedMemory; filePath: string }>;
  toArchive: Array<{ memory: CuratedMemory; fromPath: string; toPath: string }>;
  toRemove: string[];
}
