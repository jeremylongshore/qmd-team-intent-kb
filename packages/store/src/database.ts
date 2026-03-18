import Database from 'better-sqlite3';
import { TABLE_DDL } from './schema.js';

/** Options for creating a database connection */
export interface DatabaseOptions {
  /** Filesystem path or ':memory:' for an in-process test database */
  path: string;
  readonly?: boolean;
}

/**
 * Initialize a SQLite database connection with WAL mode enabled and
 * idempotent schema creation. Tables are created on first call and
 * left untouched on subsequent calls.
 */
export function createDatabase(options: DatabaseOptions): Database.Database {
  const db = new Database(options.path, {
    readonly: options.readonly ?? false,
  });

  if (!(options.readonly ?? false)) {
    // WAL mode gives better concurrent read performance while still
    // being safe for single-writer workloads.
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    for (const ddl of TABLE_DDL) {
      db.exec(ddl);
    }
  }

  return db;
}

/**
 * Create an in-memory SQLite database. The database is destroyed when
 * the connection is closed. Intended for use in tests only.
 */
export function createTestDatabase(): Database.Database {
  return createDatabase({ path: ':memory:' });
}
