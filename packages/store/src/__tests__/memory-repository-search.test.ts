import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type DatabaseType from 'better-sqlite3';
import { createTestDatabase } from '../database.js';
import { TABLE_DDL } from '../schema.js';
import { MemoryRepository } from '../repositories/memory-repository.js';
import type { CuratedMemory } from '@qmd-team-intent-kb/schema';
import { makeMemory } from './fixtures.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unique 64-char hex string suitable for contentHash */
function uniqueHash(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
}

/**
 * Build an in-memory DB with the base DDL only (no migrations) so that
 * the FTS5 virtual table does NOT exist. This forces MemoryRepository
 * into the LIKE-based search fallback path.
 */
function createLikeOnlyDatabase(): DatabaseType.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  for (const ddl of TABLE_DDL) {
    db.exec(ddl);
  }
  // Deliberately skip runMigrations — no FTS5 virtual table
  return db;
}

// ---------------------------------------------------------------------------
// LIKE-escape tests
//
// Use a database WITHOUT the FTS5 migration so searchByLike is exercised.
// ---------------------------------------------------------------------------

describe('MemoryRepository.searchByText — LIKE wildcard escaping (no-FTS5 path)', () => {
  let db: DatabaseType.Database;
  let repo: MemoryRepository;

  beforeEach(() => {
    db = createLikeOnlyDatabase();
    repo = new MemoryRepository(db);
  });

  it('percent sign in query does not break LIKE search and returns only exact matches', () => {
    repo.insert(
      makeMemory({
        title: '100% coverage requirement',
        content: 'All files must meet 100% coverage',
        contentHash: uniqueHash(),
      }),
    );
    repo.insert(
      makeMemory({
        title: 'Unrelated pattern',
        content: 'Nothing about coverage here',
        contentHash: uniqueHash(),
      }),
    );

    // Capture the result — if % is unescaped SQLite LIKE would treat it as wildcard
    // and potentially match everything. Escaped, only the row with literal "100%" matches.
    let results: CuratedMemory[] = [];
    expect(() => {
      results = repo.searchByText('100%');
    }).not.toThrow();
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('100% coverage requirement');
  });

  it('underscore in query does not act as a single-character wildcard', () => {
    repo.insert(
      makeMemory({
        title: 'snake_case naming convention',
        content: 'Use snake_case for all variable names in Python code',
        contentHash: uniqueHash(),
      }),
    );
    repo.insert(
      makeMemory({
        title: 'camelCase naming',
        content: 'Use camelCase in JavaScript and TypeScript sources',
        contentHash: uniqueHash(),
      }),
    );

    // If _ were unescaped it would be a LIKE single-char wildcard — potentially
    // matching "camelCase" etc. Escaped, it only matches the literal "snake_case".
    let results: CuratedMemory[] = [];
    expect(() => {
      results = repo.searchByText('snake_case');
    }).not.toThrow();
    for (const r of results) {
      expect((r.title + ' ' + r.content).toLowerCase()).toContain('snake_case');
    }
    expect(results).toHaveLength(1);
  });

  it('backslash in query does not break the ESCAPE clause', () => {
    repo.insert(
      makeMemory({
        title: 'Windows path convention',
        content: 'Use C:\\Users\\app for Windows installs',
        contentHash: uniqueHash(),
      }),
    );

    expect(() => {
      repo.searchByText('C:\\Users');
    }).not.toThrow();
  });

  it('query with both percent and underscore is handled safely', () => {
    repo.insert(
      makeMemory({ title: 'x_y%z pattern', content: 'mixed wildcards', contentHash: uniqueHash() }),
    );

    expect(() => {
      repo.searchByText('x_y%z');
    }).not.toThrow();
  });

  it('empty query returns an array without throwing', () => {
    repo.insert(makeMemory({ contentHash: uniqueHash() }));

    let results: CuratedMemory[] = [];
    expect(() => {
      results = repo.searchByText('');
    }).not.toThrow();
    expect(Array.isArray(results)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FTS5 search tests — createTestDatabase includes migration v2 (FTS5 table)
// ---------------------------------------------------------------------------

describe('MemoryRepository.searchByText — FTS5 path', () => {
  let db: DatabaseType.Database;
  let repo: MemoryRepository;
  let hasFts5: boolean;

  beforeEach(() => {
    db = createTestDatabase();
    // Check FTS5 availability
    try {
      db.prepare(
        "SELECT 1 FROM curated_memories_fts WHERE curated_memories_fts MATCH 'test' LIMIT 0",
      ).run();
      hasFts5 = true;
    } catch {
      hasFts5 = false;
    }
    repo = new MemoryRepository(db);
  });

  it('FTS5 virtual table exists after createTestDatabase migrations', () => {
    if (!hasFts5) return;
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE name = 'curated_memories_fts'`)
      .get() as { name: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.name).toBe('curated_memories_fts');
  });

  it('inserted memory is searchable via FTS5', () => {
    if (!hasFts5) return;
    repo.insert(
      makeMemory({
        title: 'Observability tracing convention',
        content: 'Add distributed tracing spans to every service boundary call',
        contentHash: uniqueHash(),
      }),
    );
    repo.insert(
      makeMemory({
        title: 'Deployment guide',
        content: 'Run database migrations before rolling the application',
        contentHash: uniqueHash(),
      }),
    );

    const results = repo.searchByText('tracing');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Observability tracing convention');
  });

  it('FTS5 empty query returns empty array (early-return guard)', () => {
    if (!hasFts5) return;
    repo.insert(makeMemory({ contentHash: uniqueHash() }));

    const results = repo.searchByText('');
    expect(Array.isArray(results)).toBe(true);
    // FTS5 path strips empty query → immediate return of []
    expect(results).toHaveLength(0);
  });

  it('FTS5 asterisk special char is stripped safely — does not throw', () => {
    if (!hasFts5) return;
    repo.insert(
      makeMemory({
        title: 'Glob pattern advice',
        content: 'Use glob for recursive matching in scripts',
        contentHash: uniqueHash(),
      }),
    );

    // '*' is an FTS5 operator — it is stripped, leaving empty string → early return
    let results: CuratedMemory[] = [];
    expect(() => {
      results = repo.searchByText('*');
    }).not.toThrow();
    // After stripping *, query is empty → early return []
    expect(results).toHaveLength(0);
  });

  it('FTS5 double-quote char is stripped and remaining text matches', () => {
    if (!hasFts5) return;
    repo.insert(
      makeMemory({
        title: 'Phrase search guide',
        content: 'Use phrase search for exact term matching in production queries',
        contentHash: uniqueHash(),
      }),
    );

    // '"phrase"' — quotes stripped → 'phrase'
    let results: CuratedMemory[] = [];
    expect(() => {
      results = repo.searchByText('"phrase"');
    }).not.toThrow();
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('FTS5 curly brace special char is stripped without error', () => {
    if (!hasFts5) return;
    expect(() => {
      repo.searchByText('{nearQuery}');
    }).not.toThrow();
  });

  it('only active memories are returned by FTS5 search', () => {
    if (!hasFts5) return;
    const sharedKeyword = 'deploymentxyz99';
    repo.insert(
      makeMemory({
        lifecycle: 'active',
        title: `Active ${sharedKeyword}`,
        content: `Content about ${sharedKeyword}`,
        contentHash: uniqueHash(),
      }),
    );
    repo.insert(
      makeMemory({
        lifecycle: 'deprecated',
        title: `Deprecated ${sharedKeyword}`,
        content: `Old content about ${sharedKeyword}`,
        contentHash: uniqueHash(),
      }),
    );

    const results = repo.searchByText(sharedKeyword);
    expect(results.every((r) => r.lifecycle === 'active')).toBe(true);
    expect(results).toHaveLength(1);
  });
});
