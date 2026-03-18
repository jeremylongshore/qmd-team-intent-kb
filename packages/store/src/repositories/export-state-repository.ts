import type Database from 'better-sqlite3';

/** The last-export tracking record for a single export target */
export interface ExportState {
  targetId: string;
  lastExportedAt: string;
  updatedAt: string;
}

/** Raw SQLite row shape for the export_state table */
interface ExportStateRow {
  target_id: string;
  last_exported_at: string;
  updated_at: string;
}

function rowToState(row: ExportStateRow): ExportState {
  return {
    targetId: row.target_id,
    lastExportedAt: row.last_exported_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Repository for tracking the last successful export timestamp per target.
 * Used by the git-exporter to implement incremental exports.
 */
export class ExportStateRepository {
  private readonly stmtGet: Database.Statement;
  private readonly stmtUpsert: Database.Statement;

  constructor(db: Database.Database) {
    this.stmtGet = db.prepare(`
      SELECT * FROM export_state WHERE target_id = ?
    `);

    // Use INSERT OR REPLACE (a.k.a. UPSERT) to create-or-update in one statement.
    // updated_at is written explicitly so tests can control the timestamp.
    this.stmtUpsert = db.prepare(`
      INSERT INTO export_state (target_id, last_exported_at, updated_at)
      VALUES (@target_id, @last_exported_at, datetime('now'))
      ON CONFLICT(target_id) DO UPDATE SET
        last_exported_at = excluded.last_exported_at,
        updated_at = datetime('now')
    `);
  }

  /** Return the export state for the given target, or null if never exported. */
  get(targetId: string): ExportState | null {
    const row = this.stmtGet.get(targetId) as ExportStateRow | undefined;
    return row !== undefined ? rowToState(row) : null;
  }

  /**
   * Create or update the export state for the given target.
   * updated_at is set to the current wall-clock time by the database.
   */
  set(targetId: string, lastExportedAt: string): void {
    this.stmtUpsert.run({
      target_id: targetId,
      last_exported_at: lastExportedAt,
    });
  }
}
