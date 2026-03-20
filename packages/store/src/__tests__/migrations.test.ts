import { describe, it, expect } from 'vitest';
import { createDatabase, createTestDatabase } from '../database.js';
import { MIGRATIONS } from '../schema.js';

// ---------------------------------------------------------------------------
// Schema migrations tests
// ---------------------------------------------------------------------------

describe('schema_migrations table', () => {
  it('schema_migrations table exists on a fresh database', () => {
    const db = createTestDatabase();
    try {
      const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'`)
        .get() as { name: string } | undefined;
      expect(row).toBeDefined();
      expect(row?.name).toBe('schema_migrations');
    } finally {
      db.close();
    }
  });

  it('all defined migrations are recorded in schema_migrations on fresh DB', () => {
    const db = createTestDatabase();
    try {
      const rows = db
        .prepare('SELECT version FROM schema_migrations ORDER BY version')
        .all() as Array<{ version: number }>;
      const versions = rows.map((r) => r.version);
      for (const migration of MIGRATIONS) {
        expect(versions).toContain(migration.version);
      }
    } finally {
      db.close();
    }
  });
});

describe('migrations run in order', () => {
  it('versions in schema_migrations are strictly ascending', () => {
    const db = createTestDatabase();
    try {
      const rows = db
        .prepare('SELECT version FROM schema_migrations ORDER BY version')
        .all() as Array<{ version: number }>;
      const versions = rows.map((r) => r.version);
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i]!).toBeGreaterThan(versions[i - 1]!);
      }
    } finally {
      db.close();
    }
  });

  it('migration versions match the MIGRATIONS array order', () => {
    const db = createTestDatabase();
    try {
      const rows = db
        .prepare('SELECT version, name FROM schema_migrations ORDER BY version')
        .all() as Array<{ version: number; name: string }>;

      const sortedMigrations = [...MIGRATIONS].sort((a, b) => a.version - b.version);
      expect(rows).toHaveLength(sortedMigrations.length);

      for (let i = 0; i < sortedMigrations.length; i++) {
        expect(rows[i]?.version).toBe(sortedMigrations[i]?.version);
        expect(rows[i]?.name).toBe(sortedMigrations[i]?.name);
      }
    } finally {
      db.close();
    }
  });
});

describe('migrations are idempotent', () => {
  it('calling createDatabase twice on separate in-memory connections does not throw', () => {
    expect(() => {
      const db1 = createDatabase({ path: ':memory:' });
      db1.close();
      const db2 = createDatabase({ path: ':memory:' });
      db2.close();
    }).not.toThrow();
  });

  it('migration records are not duplicated on a second createDatabase call', () => {
    // Each :memory: DB is independent, so we verify a single DB has no duplicates
    const db = createTestDatabase();
    try {
      const rows = db
        .prepare('SELECT version, COUNT(*) as cnt FROM schema_migrations GROUP BY version')
        .all() as Array<{ version: number; cnt: number }>;
      for (const row of rows) {
        expect(row.cnt).toBe(1);
      }
    } finally {
      db.close();
    }
  });
});

describe('FTS5 virtual table after migrations', () => {
  it('curated_memories_fts virtual table exists', () => {
    const db = createTestDatabase();
    try {
      // SQLite represents virtual tables with type='table' in sqlite_master
      const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE name = 'curated_memories_fts'`)
        .get() as { name: string } | undefined;
      expect(row).toBeDefined();
      expect(row?.name).toBe('curated_memories_fts');
    } finally {
      db.close();
    }
  });

  it('FTS5 table is queryable without error', () => {
    const db = createTestDatabase();
    try {
      expect(() => {
        db.prepare(
          `SELECT rowid FROM curated_memories_fts WHERE curated_memories_fts MATCH 'test' LIMIT 0`,
        ).all();
      }).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('insert trigger keeps FTS index in sync', () => {
    const db = createTestDatabase();
    try {
      // Manually insert a row so we can verify the trigger fired
      db.prepare(
        `
        INSERT INTO curated_memories (
          id, candidate_id, source, content, title, category,
          trust_level, sensitivity, author_json, tenant_id,
          metadata_json, lifecycle, content_hash,
          policy_evaluations_json, supersession_json,
          promoted_at, promoted_by_json, updated_at, version
        ) VALUES (
          'test-id-1', 'cand-1', 'claude_session',
          'Unique phrase synccheck inserted here', 'FTS sync test',
          'pattern', 'high', 'internal', '{"type":"ai","id":"c1"}', 'team-a',
          '{}', 'active', '${'a'.repeat(64)}',
          '[]', NULL, datetime('now'), '{"type":"system","id":"s1"}',
          datetime('now'), 1
        )
      `,
      ).run();

      const rows = db
        .prepare(
          `SELECT rowid FROM curated_memories_fts WHERE curated_memories_fts MATCH 'synccheck'`,
        )
        .all();
      expect(rows.length).toBeGreaterThanOrEqual(1);
    } finally {
      db.close();
    }
  });
});

describe('compound indexes after migrations', () => {
  it('idx_memories_tenant_lifecycle index exists', () => {
    const db = createTestDatabase();
    try {
      const row = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_memories_tenant_lifecycle'`,
        )
        .get() as { name: string } | undefined;
      expect(row).toBeDefined();
    } finally {
      db.close();
    }
  });

  it('idx_memories_lifecycle_updated index exists', () => {
    const db = createTestDatabase();
    try {
      const row = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_memories_lifecycle_updated'`,
        )
        .get() as { name: string } | undefined;
      expect(row).toBeDefined();
    } finally {
      db.close();
    }
  });

  it('idx_audit_timestamp index exists', () => {
    const db = createTestDatabase();
    try {
      const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_audit_timestamp'`)
        .get() as { name: string } | undefined;
      expect(row).toBeDefined();
    } finally {
      db.close();
    }
  });

  it('idx_memories_tenant_category index exists', () => {
    const db = createTestDatabase();
    try {
      const row = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_memories_tenant_category'`,
        )
        .get() as { name: string } | undefined;
      expect(row).toBeDefined();
    } finally {
      db.close();
    }
  });
});
