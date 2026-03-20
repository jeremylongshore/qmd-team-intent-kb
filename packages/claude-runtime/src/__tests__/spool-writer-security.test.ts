import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeToSpool } from '../spool/spool-writer.js';
import { buildCandidate } from '../capture/candidate-builder.js';
import type { RawCaptureEvent, GitContext } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeEvent = (overrides?: Partial<RawCaptureEvent>): RawCaptureEvent => ({
  content: 'Security test memory candidate content for spool',
  title: 'Security test candidate',
  source: 'claude_session',
  category: 'convention',
  sessionId: 'sess-security',
  ...overrides,
});

const gitCtx: GitContext = {
  repoUrl: 'https://github.com/org/repo.git',
  branch: 'main',
  userName: 'tester',
  tenantId: 'org-repo',
};

function buildValidCandidate() {
  const result = buildCandidate(makeEvent(), gitCtx);
  if (!result.ok) throw new Error(`buildCandidate failed: ${result.error}`);
  return result.value.candidate;
}

// ---------------------------------------------------------------------------
// Path traversal tests
// ---------------------------------------------------------------------------

describe('writeToSpool — path traversal rejection', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'spool-security-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('rejects agentId containing ".." to prevent directory traversal', async () => {
    const candidate = buildValidCandidate();
    // agentId with ".." would produce filename "spool-../../etc/passwd.jsonl"
    const result = await writeToSpool(candidate, tmpDir, '../../../etc/passwd');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/traversal|unsafe/i);
    }
  });

  it('rejects agentId containing null byte', async () => {
    const candidate = buildValidCandidate();
    const result = await writeToSpool(candidate, tmpDir, 'agent\0id');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/unsafe|null|traversal/i);
    }
  });

  it('rejects agentId with absolute path segment that escapes spool dir', async () => {
    const candidate = buildValidCandidate();
    // Attempt to write outside the spool dir via a crafted relative path
    const result = await writeToSpool(candidate, tmpDir, '../../outside');
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Per-agent spool filename pattern
// ---------------------------------------------------------------------------

describe('writeToSpool — per-agent spool file naming', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'spool-agent-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('uses spool-{agentId}.jsonl filename when agentId is provided', async () => {
    const candidate = buildValidCandidate();
    const agentId = 'agent-abc123';
    const result = await writeToSpool(candidate, tmpDir, agentId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const filename = result.value.split('/').pop();
      expect(filename).toBe(`spool-${agentId}.jsonl`);
    }
  });

  it('different agentIds write to separate files', async () => {
    const c1 = buildValidCandidate();
    const c2 = buildValidCandidate();

    const r1 = await writeToSpool(c1, tmpDir, 'agent-001');
    const r2 = await writeToSpool(c2, tmpDir, 'agent-002');

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.value).not.toBe(r2.value);
    }
  });

  it('same agentId appends to the same file on subsequent writes', async () => {
    const c1 = buildValidCandidate();
    const c2 = buildCandidate({ ...makeEvent(), title: 'Second event' }, gitCtx);
    expect(c2.ok).toBe(true);
    if (!c2.ok) return;

    const r1 = await writeToSpool(c1, tmpDir, 'agent-shared');
    const r2 = await writeToSpool(c2.value.candidate, tmpDir, 'agent-shared');

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      // Both writes should resolve to the same path
      expect(r1.value).toBe(r2.value);
    }
  });
});

// ---------------------------------------------------------------------------
// Daily spool filename (no agentId)
// ---------------------------------------------------------------------------

describe('writeToSpool — daily spool file (no agentId)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'spool-daily-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('without agentId, filename matches spool-YYYY-MM-DD.jsonl pattern', async () => {
    const candidate = buildValidCandidate();
    const result = await writeToSpool(candidate, tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const filename = result.value.split('/').pop();
      expect(filename).toMatch(/^spool-\d{4}-\d{2}-\d{2}\.jsonl$/);
    }
  });

  it('without agentId, file is written inside the provided spool directory', async () => {
    const candidate = buildValidCandidate();
    const result = await writeToSpool(candidate, tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.startsWith(tmpDir)).toBe(true);
    }
  });
});
