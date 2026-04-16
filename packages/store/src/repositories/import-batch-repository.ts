import type Database from 'better-sqlite3';
import type { ImportBatchStatus } from '@qmd-team-intent-kb/schema';

/** Domain representation of an import batch */
export interface ImportBatch {
  id: string;
  tenantId: string;
  sourcePath: string | null;
  fileCount: number;
  createdCount: number;
  rejectedCount: number;
  skippedCount: number;
  status: ImportBatchStatus;
  createdAt: string;
  rolledBackAt: string | null;
}

/**
 * Repository for import batch tracking and rollback support.
 */
export class ImportBatchRepository {
  private readonly stmtInsert: Database.Statement;
  private readonly stmtFindById: Database.Statement;
  private readonly stmtFindByTenant: Database.Statement;
  private readonly stmtFindByStatus: Database.Statement;
  private readonly stmtUpdateCounts: Database.Statement;
  private readonly stmtUpdateStatus: Database.Statement;

  constructor(db: Database.Database) {
    this.stmtInsert = db.prepare(`
      INSERT INTO import_batches (
        id, tenant_id, source_path, file_count,
        created_count, rejected_count, skipped_count,
        status, created_at
      ) VALUES (
        @id, @tenant_id, @source_path, @file_count,
        @created_count, @rejected_count, @skipped_count,
        @status, @created_at
      )
    `);

    this.stmtFindById = db.prepare(`
      SELECT * FROM import_batches WHERE id = ?
    `);

    this.stmtFindByTenant = db.prepare(`
      SELECT * FROM import_batches WHERE tenant_id = ? ORDER BY created_at DESC
    `);

    this.stmtFindByStatus = db.prepare(`
      SELECT * FROM import_batches WHERE status = ? ORDER BY created_at DESC
    `);

    this.stmtUpdateCounts = db.prepare(`
      UPDATE import_batches SET
        file_count = @file_count,
        created_count = @created_count,
        rejected_count = @rejected_count,
        skipped_count = @skipped_count
      WHERE id = @id
    `);

    this.stmtUpdateStatus = db.prepare(`
      UPDATE import_batches SET
        status = @status,
        rolled_back_at = @rolled_back_at
      WHERE id = @id
    `);
  }

  /** Create a new import batch record. */
  insert(batch: ImportBatch): void {
    this.stmtInsert.run({
      id: batch.id,
      tenant_id: batch.tenantId,
      source_path: batch.sourcePath,
      file_count: batch.fileCount,
      created_count: batch.createdCount,
      rejected_count: batch.rejectedCount,
      skipped_count: batch.skippedCount,
      status: batch.status,
      created_at: batch.createdAt,
    });
  }

  /** Find a batch by its primary key, or return null. */
  findById(id: string): ImportBatch | null {
    const row = this.stmtFindById.get(id) as RawBatchRow | undefined;
    return row !== undefined ? rowToBatch(row) : null;
  }

  /** All batches for a given tenant, most recent first. */
  findByTenant(tenantId: string): ImportBatch[] {
    return (this.stmtFindByTenant.all(tenantId) as RawBatchRow[]).map(rowToBatch);
  }

  /** All batches with a given status, most recent first. */
  findByStatus(status: ImportBatchStatus): ImportBatch[] {
    return (this.stmtFindByStatus.all(status) as RawBatchRow[]).map(rowToBatch);
  }

  /** Update the count fields on a batch. Returns true if a row was modified. */
  updateCounts(
    id: string,
    counts: {
      fileCount: number;
      createdCount: number;
      rejectedCount: number;
      skippedCount: number;
    },
  ): boolean {
    return (
      this.stmtUpdateCounts.run({
        id,
        file_count: counts.fileCount,
        created_count: counts.createdCount,
        rejected_count: counts.rejectedCount,
        skipped_count: counts.skippedCount,
      }).changes > 0
    );
  }

  /** Mark a batch as completed. Returns true if a row was modified. */
  complete(id: string): boolean {
    return (
      this.stmtUpdateStatus.run({
        id,
        status: 'completed',
        rolled_back_at: null,
      }).changes > 0
    );
  }

  /** Mark a batch as rolled back. Returns true if a row was modified. */
  rollback(id: string, rolledBackAt: string): boolean {
    return (
      this.stmtUpdateStatus.run({
        id,
        status: 'rolled_back',
        rolled_back_at: rolledBackAt,
      }).changes > 0
    );
  }
}

/** Raw row shape from SQLite */
interface RawBatchRow {
  id: string;
  tenant_id: string;
  source_path: string | null;
  file_count: number;
  created_count: number;
  rejected_count: number;
  skipped_count: number;
  status: string;
  created_at: string;
  rolled_back_at: string | null;
}

function rowToBatch(row: RawBatchRow): ImportBatch {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sourcePath: row.source_path,
    fileCount: row.file_count,
    createdCount: row.created_count,
    rejectedCount: row.rejected_count,
    skippedCount: row.skipped_count,
    status: row.status as ImportBatchStatus,
    createdAt: row.created_at,
    rolledBackAt: row.rolled_back_at,
  };
}
