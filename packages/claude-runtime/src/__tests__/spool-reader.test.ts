import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeToSpool } from '../spool/spool-writer.js';
import { readSpoolFile, listSpoolFiles } from '../spool/spool-reader.js';
import { buildCandidate } from '../capture/candidate-builder.js';
import type { RawCaptureEvent, GitContext } from '../types.js';

const makeEvent = (title = 'Test candidate'): RawCaptureEvent => ({
  content: 'Test memory candidate content',
  title,
  source: 'claude_session',
  category: 'convention',
  sessionId: 'sess-test',
});

const gitCtx: GitContext = {
  repoUrl: 'https://github.com/org/repo.git',
  branch: 'main',
  userName: 'tester',
  tenantId: 'org-repo',
};

describe('spool-reader', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'spool-read-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('readSpoolFile', () => {
    it('reads and parses candidates from spool file', async () => {
      const r = buildCandidate(makeEvent(), gitCtx);
      expect(r.ok).toBe(true);
      if (!r.ok) return;

      const writeResult = await writeToSpool(r.value.candidate, tmpDir);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const readResult = await readSpoolFile(writeResult.value);
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;

      expect(readResult.value).toHaveLength(1);
      expect(readResult.value[0]!.title).toBe('Test candidate');
    });

    it('returns error for non-existent file', async () => {
      const result = await readSpoolFile('/nonexistent/file.jsonl');
      expect(result.ok).toBe(false);
    });
  });

  describe('listSpoolFiles', () => {
    it('lists spool files in directory', async () => {
      const r = buildCandidate(makeEvent(), gitCtx);
      expect(r.ok).toBe(true);
      if (!r.ok) return;

      await writeToSpool(r.value.candidate, tmpDir);

      const result = await listSpoolFiles(tmpDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.length).toBeGreaterThanOrEqual(1);
      expect(result.value[0]).toMatch(/spool-\d{4}-\d{2}-\d{2}\.jsonl$/);
    });

    it('returns empty array for empty directory', async () => {
      const result = await listSpoolFiles(tmpDir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it('returns error for non-existent directory', async () => {
      const result = await listSpoolFiles('/nonexistent/dir');
      expect(result.ok).toBe(false);
    });
  });
});
