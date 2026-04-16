import {
  createDatabase,
  CandidateRepository,
  MemoryRepository,
  ImportBatchRepository,
  MemoryLinksRepository,
} from '@qmd-team-intent-kb/store';
import { previewImport, executeImport, rollbackImport } from '@qmd-team-intent-kb/curator';
import type {
  ImportPreviewResult,
  ImportExecutionResult,
  RollbackResult,
} from '@qmd-team-intent-kb/curator';
import type { McpServerConfig } from '../config.js';

interface VaultImportInput {
  sourcePath: string;
  excludeDirs?: string[];
}

interface VaultRollbackInput {
  batchId: string;
}

/**
 * Run a preview of vault import — reports what would happen without persisting.
 */
export async function vaultPreview(
  input: VaultImportInput,
  config: McpServerConfig,
): Promise<ImportPreviewResult> {
  const db = createDatabase({ path: config.dbPath });
  try {
    const deps = {
      candidateRepo: new CandidateRepository(db),
      memoryRepo: new MemoryRepository(db),
      batchRepo: new ImportBatchRepository(db),
    };
    return await previewImport(input.sourcePath, config.tenantId, deps, input.excludeDirs);
  } finally {
    db.close();
  }
}

/**
 * Execute a vault import — walks directory, creates candidates with batch tracking.
 */
export async function vaultExecute(
  input: VaultImportInput,
  config: McpServerConfig,
): Promise<ImportExecutionResult> {
  const db = createDatabase({ path: config.dbPath });
  try {
    const deps = {
      candidateRepo: new CandidateRepository(db),
      memoryRepo: new MemoryRepository(db),
      batchRepo: new ImportBatchRepository(db),
    };
    return await executeImport(input.sourcePath, config.tenantId, deps, input.excludeDirs);
  } finally {
    db.close();
  }
}

/**
 * Roll back a vault import batch — deletes all candidates and marks batch rolled_back.
 */
export function vaultRollback(input: VaultRollbackInput, config: McpServerConfig): RollbackResult {
  const db = createDatabase({ path: config.dbPath });
  try {
    const deps = {
      candidateRepo: new CandidateRepository(db),
      memoryRepo: new MemoryRepository(db),
      batchRepo: new ImportBatchRepository(db),
    };
    const linksRepo = new MemoryLinksRepository(db);
    return rollbackImport(input.batchId, deps, linksRepo);
  } finally {
    db.close();
  }
}
