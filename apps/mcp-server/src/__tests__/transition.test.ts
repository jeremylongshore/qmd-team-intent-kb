import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '@qmd-team-intent-kb/store';
import { MemoryRepository } from '@qmd-team-intent-kb/store';
import type { CuratedMemory } from '@qmd-team-intent-kb/schema';
import { applyTransition } from '../tools/transition.js';
import type { McpServerConfig } from '../config.js';
import { FIXED_NOW, makeMemory } from './fixtures.js';

const nowFn = () => FIXED_NOW;

describe('applyTransition()', () => {
  let tmpDir: string;
  let dbPath: string;
  let config: McpServerConfig;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'teamkb-transition-'));
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

  function seedMemory(memory: CuratedMemory): void {
    const db = createDatabase({ path: dbPath });
    const repo = new MemoryRepository(db);
    repo.insert(memory);
    db.close();
  }

  it('transitions active → deprecated successfully', () => {
    const memory = makeMemory({ lifecycle: 'active' });
    seedMemory(memory);

    const result = applyTransition(
      {
        memoryId: memory.id,
        to: 'deprecated',
        reason: 'Superseded by new convention',
        actor: 'user-1',
      },
      config,
      nowFn,
    );

    expect(result.memoryId).toBe(memory.id);
    expect(result.from).toBe('active');
    expect(result.to).toBe('deprecated');
    expect(result.message).toContain('deprecated');
  });

  it('transitions active → archived successfully', () => {
    const memory = makeMemory({ lifecycle: 'active' });
    seedMemory(memory);

    const result = applyTransition(
      { memoryId: memory.id, to: 'archived', reason: 'Permanently retiring this.', actor: 'admin' },
      config,
      nowFn,
    );

    expect(result.from).toBe('active');
    expect(result.to).toBe('archived');
  });

  it('returns a valid UUID for auditEventId', () => {
    const memory = makeMemory();
    seedMemory(memory);

    const result = applyTransition(
      { memoryId: memory.id, to: 'deprecated', reason: 'Old.', actor: 'user-2' },
      config,
      nowFn,
    );

    expect(result.auditEventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('persists the new lifecycle state to the DB', () => {
    const memory = makeMemory({ lifecycle: 'active' });
    seedMemory(memory);

    applyTransition(
      { memoryId: memory.id, to: 'deprecated', reason: 'No longer needed.', actor: 'user-1' },
      config,
      nowFn,
    );

    const db = createDatabase({ path: dbPath, readonly: true });
    const repo = new MemoryRepository(db);
    const updated = repo.findById(memory.id);
    db.close();

    expect(updated?.lifecycle).toBe('deprecated');
  });

  it('throws for an invalid lifecycle transition (archived → active)', () => {
    const memory = makeMemory({ lifecycle: 'archived' });
    seedMemory(memory);

    expect(() =>
      applyTransition(
        { memoryId: memory.id, to: 'active', reason: 'Trying to revive.', actor: 'user-1' },
        config,
        nowFn,
      ),
    ).toThrow(/not allowed/i);
  });

  it('throws when memoryId does not exist', () => {
    const db = createDatabase({ path: dbPath });
    db.close(); // Ensure DB file exists with schema

    expect(() =>
      applyTransition(
        { memoryId: randomUUID(), to: 'deprecated', reason: 'Ghost.', actor: 'user-1' },
        config,
        nowFn,
      ),
    ).toThrow(/not found/i);
  });

  it('throws for invalid UUID format', () => {
    expect(() =>
      applyTransition(
        { memoryId: 'not-a-uuid', to: 'deprecated', reason: 'Bad ID.', actor: 'user-1' },
        config,
        nowFn,
      ),
    ).toThrow();
  });
});
