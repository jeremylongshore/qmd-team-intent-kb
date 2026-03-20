import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatabase, createTestDatabase, MemoryRepository } from '@qmd-team-intent-kb/store';
import { computeContentHash } from '@qmd-team-intent-kb/common';
import type { CuratedMemory } from '@qmd-team-intent-kb/schema';
import { getStatus } from '../tools/status.js';
import type { McpServerConfig } from '../config.js';

const NOW = '2026-01-15T10:00:00.000Z';

function makeMemory(overrides?: Partial<CuratedMemory>): CuratedMemory {
  const content = 'Use Result<T,E> for fallible operations';
  return {
    id: randomUUID(),
    candidateId: randomUUID(),
    source: 'mcp',
    content,
    title: 'Error handling convention',
    category: 'convention',
    trustLevel: 'high',
    sensitivity: 'internal',
    author: { type: 'ai', id: 'mcp-server' },
    tenantId: 'test-tenant',
    metadata: { filePaths: [], tags: [] },
    lifecycle: 'active',
    contentHash: computeContentHash(content),
    policyEvaluations: [],
    promotedAt: NOW,
    promotedBy: { type: 'human', id: 'user-1', name: 'Test User' },
    updatedAt: NOW,
    version: 1,
    ...overrides,
  } as CuratedMemory;
}

describe('getStatus() — empty DB', () => {
  let tmpDir: string;
  let config: McpServerConfig;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'teamkb-status-empty-'));
    config = {
      tenantId: 'test-tenant',
      basePath: tmpDir,
      spoolPath: join(tmpDir, 'spool'),
      // Point to a non-existent DB to test graceful handling
      dbPath: join(tmpDir, 'nonexistent.db'),
      feedbackPath: join(tmpDir, 'feedback'),
    };
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns zero total when DB does not exist', () => {
    const result = getStatus(config);
    expect(result.counts.total).toBe(0);
  });

  it('returns empty byLifecycle when DB does not exist', () => {
    const result = getStatus(config);
    expect(result.counts.byLifecycle).toEqual({});
  });

  it('returns empty recentFeedback when feedback dir does not exist', () => {
    const result = getStatus(config);
    expect(result.recentFeedback).toEqual([]);
  });

  it('returns the configured dbPath', () => {
    const result = getStatus(config);
    expect(result.dbPath).toBe(config.dbPath);
  });
});

describe('getStatus() — populated DB', () => {
  // Write data via a read-write connection, then call getStatus which opens
  // a separate read-only connection. SQLite WAL mode supports concurrent readers.
  let tmpDir: string;
  let dbPath: string;
  let config: McpServerConfig;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'teamkb-status-pop-'));
    dbPath = join(tmpDir, 'teamkb.db');
    config = {
      tenantId: 'test-tenant',
      basePath: tmpDir,
      spoolPath: join(tmpDir, 'spool'),
      dbPath,
      feedbackPath: join(tmpDir, 'feedback'),
    };
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns correct total count', () => {
    const db = createDatabase({ path: dbPath });
    const repo = new MemoryRepository(db);
    repo.insert(makeMemory());
    repo.insert(makeMemory({ lifecycle: 'deprecated' }));
    db.close();

    const result = getStatus(config);
    expect(result.counts.total).toBe(2);
  });

  it('groups counts by lifecycle state', () => {
    const db = createDatabase({ path: dbPath });
    const repo = new MemoryRepository(db);
    repo.insert(makeMemory({ lifecycle: 'active' }));
    repo.insert(makeMemory({ lifecycle: 'active', id: randomUUID(), candidateId: randomUUID() }));
    repo.insert(makeMemory({ lifecycle: 'archived', id: randomUUID(), candidateId: randomUUID() }));
    db.close();

    const result = getStatus(config);
    expect(result.counts.byLifecycle['active']).toBe(2);
    expect(result.counts.byLifecycle['archived']).toBe(1);
  });

  it('groups counts by category', () => {
    const db = createDatabase({ path: dbPath });
    const repo = new MemoryRepository(db);
    repo.insert(makeMemory({ category: 'decision' }));
    repo.insert(
      makeMemory({ category: 'convention', id: randomUUID(), candidateId: randomUUID() }),
    );
    db.close();

    const result = getStatus(config);
    expect(result.counts.byCategory['decision']).toBe(1);
    expect(result.counts.byCategory['convention']).toBe(1);
  });
});

describe('getStatus() — in-memory DB via createTestDatabase', () => {
  it('returns zero total for a fresh in-memory database', () => {
    // We cannot pass an in-memory DB path to getStatus (it would open a separate
    // connection), so we verify the repository directly here.
    const db = createTestDatabase();
    const repo = new MemoryRepository(db);
    expect(repo.count()).toBe(0);
    db.close();
  });
});
