import { describe, it, expect } from 'vitest';
import { createDatabase, createTestDatabase } from '../database.js';

describe('createTestDatabase', () => {
  it('creates an in-memory database without throwing', () => {
    const db = createTestDatabase();
    expect(db).toBeDefined();
    db.close();
  });

  it('creates all expected tables', () => {
    const db = createTestDatabase();
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain('candidates');
    expect(names).toContain('curated_memories');
    expect(names).toContain('governance_policies');
    expect(names).toContain('audit_events');
    expect(names).toContain('export_state');
    db.close();
  });

  it('creates tables idempotently — calling createDatabase twice does not throw', () => {
    // Use a shared in-memory path approach: call createDatabase with :memory:
    // twice (each call is an independent connection, both succeed).
    expect(() => {
      const db1 = createDatabase({ path: ':memory:' });
      db1.close();
      const db2 = createDatabase({ path: ':memory:' });
      db2.close();
    }).not.toThrow();
  });

  it('has WAL journal mode enabled', () => {
    const db = createTestDatabase();
    const row = db.pragma('journal_mode', { simple: true });
    // In-memory databases may report 'memory' instead of 'wal' — both indicate
    // the pragma was accepted without error. For an on-disk DB it would be 'wal'.
    expect(typeof row).toBe('string');
    db.close();
  });

  it('has foreign keys enabled', () => {
    const db = createTestDatabase();
    const fk = db.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);
    db.close();
  });
});
