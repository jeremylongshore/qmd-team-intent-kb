import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDatabase } from '../database.js';
import { ExportStateRepository } from '../repositories/export-state-repository.js';

const TS_A = '2026-01-15T10:00:00.000Z';
const TS_B = '2026-02-01T12:00:00.000Z';

describe('ExportStateRepository', () => {
  let db: Database.Database;
  let repo: ExportStateRepository;

  beforeEach(() => {
    db = createTestDatabase();
    repo = new ExportStateRepository(db);
  });

  it('set stores state and get retrieves it', () => {
    repo.set('git-mirror-1', TS_A);
    const state = repo.get('git-mirror-1');
    expect(state).not.toBeNull();
    expect(state?.targetId).toBe('git-mirror-1');
    expect(state?.lastExportedAt).toBe(TS_A);
    // updatedAt is set by the DB — just verify it is a non-empty string
    expect(typeof state?.updatedAt).toBe('string');
    expect((state?.updatedAt ?? '').length).toBeGreaterThan(0);
  });

  it('set performs an upsert — calling again updates lastExportedAt', () => {
    repo.set('git-mirror-1', TS_A);
    repo.set('git-mirror-1', TS_B);
    const state = repo.get('git-mirror-1');
    expect(state?.lastExportedAt).toBe(TS_B);
  });

  it('returns null for a target that has never been set', () => {
    expect(repo.get('unknown-target')).toBeNull();
  });
});
