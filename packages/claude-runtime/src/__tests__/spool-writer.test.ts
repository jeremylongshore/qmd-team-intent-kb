import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeToSpool } from '../spool/spool-writer.js';
import { buildCandidate } from '../capture/candidate-builder.js';
import type { RawCaptureEvent, GitContext } from '../types.js';

const makeEvent = (): RawCaptureEvent => ({
  content: 'Test memory candidate content',
  title: 'Test candidate',
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

describe('writeToSpool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'spool-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes a candidate to a JSONL spool file', async () => {
    const buildResult = buildCandidate(makeEvent(), gitCtx);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    const result = await writeToSpool(buildResult.value.candidate, tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await readFile(result.value, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]!);
    expect(parsed.status).toBe('inbox');
    expect(parsed.title).toBe('Test candidate');
  });

  it('appends multiple candidates to the same file', async () => {
    const r1 = buildCandidate(makeEvent(), gitCtx);
    const r2 = buildCandidate({ ...makeEvent(), title: 'Second candidate' }, gitCtx);
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;

    await writeToSpool(r1.value.candidate, tmpDir);
    const result = await writeToSpool(r2.value.candidate, tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await readFile(result.value, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('creates spool directory if it does not exist', async () => {
    const nestedDir = join(tmpDir, 'nested', 'spool');
    const r = buildCandidate(makeEvent(), gitCtx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const result = await writeToSpool(r.value.candidate, nestedDir);
    expect(result.ok).toBe(true);
  });
});
