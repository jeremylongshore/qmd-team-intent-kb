import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDatabase } from '../database.js';
import { ImportBatchRepository } from '../repositories/import-batch-repository.js';
import type { ImportBatch } from '../repositories/import-batch-repository.js';

const NOW = '2026-01-15T10:00:00.000Z';

function makeBatch(overrides?: Partial<ImportBatch>): ImportBatch {
  return {
    id: 'batch-1',
    tenantId: 'tenant-1',
    sourcePath: '/path/to/vault',
    fileCount: 0,
    createdCount: 0,
    rejectedCount: 0,
    skippedCount: 0,
    status: 'active',
    createdAt: NOW,
    rolledBackAt: null,
    ...overrides,
  };
}

describe('ImportBatchRepository', () => {
  let db: Database.Database;
  let repo: ImportBatchRepository;

  beforeEach(() => {
    db = createTestDatabase();
    repo = new ImportBatchRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('inserts and retrieves a batch by id', () => {
    repo.insert(makeBatch());
    const found = repo.findById('batch-1');
    expect(found).not.toBeNull();
    expect(found!.tenantId).toBe('tenant-1');
    expect(found!.sourcePath).toBe('/path/to/vault');
    expect(found!.status).toBe('active');
  });

  it('returns null for non-existent id', () => {
    expect(repo.findById('nope')).toBeNull();
  });

  it('findByTenant returns batches for a tenant', () => {
    repo.insert(makeBatch());
    repo.insert(makeBatch({ id: 'batch-2', tenantId: 'tenant-1' }));
    repo.insert(makeBatch({ id: 'batch-3', tenantId: 'tenant-2' }));
    expect(repo.findByTenant('tenant-1')).toHaveLength(2);
    expect(repo.findByTenant('tenant-2')).toHaveLength(1);
  });

  it('findByStatus returns batches with given status', () => {
    repo.insert(makeBatch());
    repo.insert(makeBatch({ id: 'batch-2', status: 'completed' }));
    expect(repo.findByStatus('active')).toHaveLength(1);
    expect(repo.findByStatus('completed')).toHaveLength(1);
    expect(repo.findByStatus('rolled_back')).toHaveLength(0);
  });

  it('updateCounts modifies count fields', () => {
    repo.insert(makeBatch());
    const updated = repo.updateCounts('batch-1', {
      fileCount: 10,
      createdCount: 7,
      rejectedCount: 2,
      skippedCount: 1,
    });
    expect(updated).toBe(true);

    const found = repo.findById('batch-1')!;
    expect(found.fileCount).toBe(10);
    expect(found.createdCount).toBe(7);
    expect(found.rejectedCount).toBe(2);
    expect(found.skippedCount).toBe(1);
  });

  it('updateCounts returns false for non-existent id', () => {
    expect(
      repo.updateCounts('nope', {
        fileCount: 0,
        createdCount: 0,
        rejectedCount: 0,
        skippedCount: 0,
      }),
    ).toBe(false);
  });

  it('complete marks batch as completed', () => {
    repo.insert(makeBatch());
    expect(repo.complete('batch-1')).toBe(true);
    const found = repo.findById('batch-1')!;
    expect(found.status).toBe('completed');
    expect(found.rolledBackAt).toBeNull();
  });

  it('rollback marks batch as rolled_back with timestamp', () => {
    repo.insert(makeBatch());
    const rollbackTime = '2026-01-15T12:00:00.000Z';
    expect(repo.rollback('batch-1', rollbackTime)).toBe(true);
    const found = repo.findById('batch-1')!;
    expect(found.status).toBe('rolled_back');
    expect(found.rolledBackAt).toBe(rollbackTime);
  });

  it('handles null sourcePath', () => {
    repo.insert(makeBatch({ sourcePath: null }));
    const found = repo.findById('batch-1')!;
    expect(found.sourcePath).toBeNull();
  });
});
