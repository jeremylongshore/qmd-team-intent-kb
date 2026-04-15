import { z } from 'zod';
import type Database from 'better-sqlite3';

/** The last-export tracking record for a single export target */
export interface ExportState {
  targetId: string;
  lastExportedAt: string;
  updatedAt: string;
}

/**
 * Zod schema for the raw SQLite row returned by better-sqlite3.
 * Validates the flat DB representation before mapping to ExportState.
 */
const ExportStateRowSchema = z.object({
  target_id: z.string(),
  last_exported_at: z.string(),
  updated_at: z.string(),
});

/**
 * Parse a raw SQLite row into a validated ExportState object.
 * Throws a descriptive error if the row fails validation.
 *
 * @param row - unknown value from better-sqlite3 .get()
 * @returns validated ExportState
 * @throws Error with column details if parsing fails
 */
function rowToState(row: unknown): ExportState {
  const result = ExportStateRowSchema.safeParse(row);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`export_state row failed validation: ${issues.join('; ')}`);
  }
  const flat = result.data;
  return {
    targetId: flat.target_id,
    lastExportedAt: flat.last_exported_at,
    updatedAt: flat.updated_at,
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

    // updated_at is set by the database (datetime('now')) to avoid app/DB clock drift.
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
    const row = this.stmtGet.get(targetId);
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
